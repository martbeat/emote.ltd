import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('journeys', Path(__file__).parents[2] / 'stats/generate_journeys.py')
journeys = importlib.util.module_from_spec(spec)
spec.loader.exec_module(journeys)


def line(time, path, address='192.0.2.1', agent='Mozilla/5.0 Test Browser', status=200):
    return f'{address} - - [25/Oct/2026:{time} +0000] "GET {path} HTTP/1.1" {status} 50 "https://emote.ltd/?private=secret" "{agent}"\n'


class JourneyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in ['index.html', 'tools.html', 'downloads/paper.pdf', 'stats/index.html']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('test')
        self.routes = journeys.public_routes(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def report(self, lines):
        log = self.root / 'access.log'
        log.write_text(''.join(lines))
        return journeys.build_report([log, log], self.routes, now=datetime(2026,10,25,13,tzinfo=timezone.utc),min_steps=1)

    def test_chronology_privacy_and_inactivity(self):
        result = self.report([line('12:02:00','/downloads/paper.pdf?token=secret'),
                              line('12:00:00','/index.html?name=Martin'),
                              line('12:01:00','/tools.html'), line('12:32:00','/')])
        self.assertEqual(result['inferred_visits'],2)
        steps = result['visits'][1]['steps']
        self.assertEqual([s['path'] for s in steps],['/','/tools.html','/downloads/paper.pdf'])
        self.assertEqual(steps[0]['gap_seconds'],60)
        self.assertIsNone(steps[-1]['gap_seconds'])
        text = json.dumps(result)
        for secret in ['192.0.2.1','Mozilla','secret','Martin','private=']:
            self.assertNotIn(secret,text)

    def test_exclusions_network_groups_and_window(self):
        result = self.report([line('12:00:00','/'), line('12:01:00','/tools.html',address='192.0.2.2'),
            line('12:01:00','/tools.html',agent='Googlebot'),line('12:02:00','/stats/'),
            line('12:02:00','/unknown.html?secret=yes'),line('12:02:00','/tools.html',status=404),
            line('14:00:00','/'),line('12:02:00','/tools.html',agent='-')])
        self.assertEqual(result['inferred_visits'],2)
        self.assertEqual(result['included_requests'],2)
        self.assertEqual(result['recognised_automation_requests_excluded'],2)

    def test_limits_and_missing_coverage(self):
        result = self.report(['bad log\n'])
        self.assertIsNone(result['observed_start'])
        self.assertEqual(result['unparseable_lines'],1)
        self.assertEqual(result['visits'],[])
        log = self.root / 'access.log'
        log.write_text(line('12:00:00','/')+line('12:01:00','/tools.html'))
        report = journeys.build_report([log],self.routes,now=datetime(2026,10,25,13,tzinfo=timezone.utc),max_steps=1)
        self.assertTrue(report['visits'][0]['steps_truncated'])
        self.assertEqual(report['visits'][0]['request_count'],2)

    def test_seven_day_default_and_filter_before_limit(self):
        log = self.root / 'access.log'
        older = [line('12:00:00','/').replace('25/Oct','19/Oct'),
                 line('12:01:00','/tools.html').replace('25/Oct','19/Oct')]
        too_old = [line('12:00:00','/').replace('25/Oct','17/Oct'),
                   line('12:01:00','/tools.html').replace('25/Oct','17/Oct')]
        singles = [line('12:30:00','/',address=f'192.0.2.{i+2}') for i in range(60)]
        log.write_text(''.join(older + too_old + singles))
        now = datetime(2026,10,25,13,tzinfo=timezone.utc)
        report = journeys.build_report([log],self.routes,now=now,limit=1)
        self.assertEqual(report['minimum_steps'],2)
        self.assertEqual(report['inferred_visits'],1)
        self.assertEqual(report['all_inferred_visits'],61)
        self.assertEqual(report['included_requests'],2)
        self.assertEqual(report['visits'][0]['request_count'],2)
        self.assertEqual(report['window_start'],'2026-10-18T13:00:00+00:00')
        short = journeys.build_report([log],self.routes,now=now,hours=24)
        self.assertEqual(short['visits'],[])

    def test_consecutive_reloads_are_one_step_and_pdf_duplicates_preserve_counts(self):
        log = self.root / 'access.log'
        log.write_text(''.join([line('12:00:00','/'),line('12:00:00','/index.html'),
            line('12:01:00','/downloads/paper.pdf'),line('12:01:00','/downloads/paper.pdf')]))
        report = journeys.build_report([log],self.routes,now=datetime(2026,10,25,13,tzinfo=timezone.utc))
        visit = report['visits'][0]
        self.assertEqual(visit['navigation_step_count'],2)
        self.assertEqual(visit['request_count'],4)
        self.assertEqual([step['requests'] for step in visit['steps']],[2,2])
        self.assertEqual(visit['automation_class'],'unclassified')
        log.write_text(line('12:00:00','/')+line('12:01:00','/'))
        self.assertEqual(journeys.build_report([log],self.routes,now=datetime(2026,10,25,13,tzinfo=timezone.utc))['visits'],[])

    def test_broad_bursts_flagged_but_reload_testing_and_small_fast_pairs_are_not(self):
        now = datetime(2026,10,25,12,tzinfo=timezone.utc)
        burst = [(now,f'/page{i}.html','Page') for i in range(8)]
        self.assertEqual(journeys.automation_assessment(burst)[0],'likely_automated')
        slow = [(now + journeys.timedelta(seconds=i*20),f'/page{i}.html','Page') for i in range(8)]
        self.assertEqual(journeys.automation_assessment(slow)[0],'unclassified')
        repeated = [(now,'/scrym-deep-fry/','Page') for _ in range(40)]
        self.assertEqual(journeys.automation_assessment(repeated)[0],'unclassified')
        pair = [(now,'/','Page'),(now + journeys.timedelta(seconds=2),'/about.html','Page')]
        self.assertEqual(journeys.automation_assessment(pair)[0],'unclassified')
        small = [(now,f'/article{i}.html','Page') for i in range(3)]
        kind,reasons = journeys.automation_assessment(small)
        self.assertEqual(kind,'unclassified')
        self.assertIn('uncertain',reasons[0])

    def test_separate_quotas_keep_bursts_from_displacing_reviewable_visits(self):
        log=self.root/'access.log'
        log.write_text(''.join([line('12:00:00','/',address='192.0.2.1'),line('12:01:00','/tools.html',address='192.0.2.1')]+
            [line('12:30:00',f'/p{i}.html',address='192.0.2.2') for i in range(8)]))
        routes={**self.routes,**{f'/p{i}.html':(f'/p{i}.html','Page') for i in range(8)}}
        report=journeys.build_report([log],routes,now=datetime(2026,10,25,13,tzinfo=timezone.utc),limit=1)
        self.assertEqual(report['displayed_visits'],2)
        self.assertEqual(report['likely_automated_visits'],1)
        self.assertEqual(report['unclassified_visits'],1)
        self.assertEqual(report['visits'][0]['automation_class'],'unclassified')

    def test_private_client_details_and_report_local_comparison_keys(self):
        log=self.root/'access.log'
        chrome='Mozilla/5.0 (Windows NT 10.0) Chrome/141.0.0.0 Safari/537.36'
        firefox='Mozilla/5.0 Firefox/143.0'
        events=[line('12:00:00','/',agent=chrome),line('12:01:00','/tools.html',agent=chrome),
            line('12:40:00','/',agent=chrome),line('12:41:00','/tools.html',agent=chrome),
            line('12:45:00','/',agent=firefox),line('12:46:00','/tools.html',agent=firefox)]
        log.write_text(''.join(events))
        now=datetime(2026,10,25,13,tzinfo=timezone.utc)
        report=journeys.build_report([log],self.routes,now=now)
        self.assertNotIn('192.0.2.1',json.dumps(report))
        self.assertNotIn('Mozilla/5.0',json.dumps(report))
        self.assertTrue(all('client_details' not in visit for visit in report['visits']))
        self.assertEqual(len({visit['network_key'] for visit in report['visits']}),1)
        self.assertEqual(len({visit['client_key'] for visit in report['visits']}),2)
        self.assertEqual(len({visit['browser_key'] for visit in report['visits']}),2)
        other=journeys.build_report([log],self.routes,now=now,include_client_details=True)
        self.assertTrue(other['client_details_included'])
        self.assertEqual(other['visits'][0]['client_details']['logged_ip'],'192.0.2.1')
        self.assertIn('Mozilla/5.0',other['visits'][0]['client_details']['user_agent'])
        self.assertNotEqual(report['visits'][0]['network_key'],other['visits'][0]['network_key'])

    def test_json_headers_exclude_declared_prefetch_and_embeds_and_expose_proxy_ambiguity(self):
        log=self.root/'diagnostic.log'
        def record(path,when,**extra):
            return json.dumps({'time':when,'remote_addr':'127.0.0.1','user_agent':'Mozilla Chrome/141.0',
                'method':'GET','uri':path,'status':200,'referrer':'https://emote.ltd/?secret=hidden',
                'fetch_dest':'document','fetch_mode':'navigate','fetch_user':'?1',**extra})+'\n'
        log.write_text(''.join([record('/','2026-10-25T12:00:00Z',cf_connecting_ip='192.0.2.10'),
            record('/tools.html','2026-10-25T12:01:00Z',cf_connecting_ip='192.0.2.11'),
            record('/downloads/paper.pdf','2026-10-25T12:02:00Z',sec_purpose='prefetch;prerender'),
            record('/tools.html','2026-10-25T12:03:00Z',fetch_dest='iframe')]))
        report=journeys.build_report([log],self.routes,now=datetime(2026,10,25,13,tzinfo=timezone.utc),include_client_details=True)
        self.assertEqual(report['prefetch_requests_excluded'],1)
        self.assertEqual(report['embedded_page_requests_excluded'],1)
        self.assertEqual(report['purpose_metadata_requests'],4)
        visit=report['visits'][0]
        self.assertEqual(visit['forwarded_ip_count'],2)
        self.assertEqual(visit['client_details']['logged_ip'],'127.0.0.1')
        self.assertIn('non-public',visit['client_details']['address_scope'])
        self.assertEqual(visit['steps'][0]['request_contexts'][0]['referrer_path'],'/')
        self.assertNotIn('secret',json.dumps(report))
        self.assertEqual(report['included_requests'],2)
        redacted=journeys.build_report([log],self.routes,now=datetime(2026,10,25,13,tzinfo=timezone.utc))
        self.assertNotIn('192.0.2.10',json.dumps(redacted))
        self.assertNotIn('127.0.0.1',json.dumps(redacted))
        self.assertIsNone(journeys.parse_line('{"time":"bad"}'))

class CommandTests(unittest.TestCase):
    def test_public_output_and_missing_logs_are_rejected(self):
        import subprocess
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'index.html').write_text('public')
            (root/'tools.html').write_text('public')
            command = ['python3',str(Path(journeys.__file__)),'--site-root',str(root),
                       '--log',str(root/'missing.log'),'--output',str(root/'journeys.json')]
            result = subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('outside the public web root',result.stderr)
            self.assertFalse((root/'journeys.json').exists())
            command[-1] = str(root.parent / 'private-no-log-report.json')
            result = subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('No log files matched',result.stderr)


    def test_private_export_works_with_compressed_logs(self):
        import gzip
        import subprocess
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            root = base / 'public'
            root.mkdir()
            (root/'index.html').write_text('public')
            (root/'tools.html').write_text('public')
            log = base/'access.log.gz'
            stamp = datetime.now(timezone.utc).strftime('%d/%b/%Y:%H:%M:%S %z')
            with gzip.open(log,'wt') as stream:
                stream.write(f'192.0.2.10 - - [{stamp}] "GET /?secret=hidden HTTP/1.1" 200 10 "-" "Mozilla Test"\n')
                stream.write(f'192.0.2.10 - - [{stamp}] "GET /tools.html HTTP/1.1" 200 10 "-" "Mozilla Test"\n')
            output = base/'private'/'journeys.json'
            result = subprocess.run(['python3',str(Path(journeys.__file__)),'--site-root',str(root),
                '--log',str(log),'--output',str(output)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            report = json.loads(output.read_text())
            self.assertEqual(report['inferred_visits'],1)
            self.assertEqual(report['visits'][0]['steps'][0]['path'],'/')
            self.assertNotIn('hidden',output.read_text())
            self.assertEqual(output.stat().st_mode & 0o777,0o640)


if __name__ == '__main__':
    unittest.main()
