#!/usr/bin/env python3
"""Build a reproducible RBC dictionary from public aggregate name lists, never case documents.
Requires openpyxl. See docs/redactor-name-dictionary.md for sources and download commands.
"""
import argparse, csv, hashlib, io, json, unicodedata
from pathlib import Path
from zipfile import ZipFile
import openpyxl

def normalise(value):
    value=unicodedata.normalize('NFD',value.strip().replace('’',"'").lower())
    value=''.join(c for c in value if unicodedata.category(c)!='Mn')
    value=' '.join(value.split())
    if not 2<=len(value)<=100 or not all(c.isalpha() or c in " -'." for c in value):
        return None
    return value

def census_names(path):
    workbook=openpyxl.load_workbook(path,read_only=True,data_only=True)
    names=set()
    for row in workbook.active.iter_rows(values_only=True):
        if len(row)>2 and isinstance(row[0],str) and isinstance(row[1],(int,float)) and row[1]>=1:
            name=normalise(row[0])
            if name:names.add(name)
    workbook.close()
    return names

def build(directory,updated):
    given=set();years=[]
    with ZipFile(directory/'ssa-names.zip') as archive:
        for name in sorted(archive.namelist()):
            if not (name.startswith('yob') and name.endswith('.txt')):continue
            years.append(int(name[3:7]))
            for row in csv.reader(io.StringIO(archive.read(name).decode('utf-8-sig'))):
                if len(row)!=3 or int(row[2])<5:continue
                value=normalise(row[0])
                if value:given.add(value)
    sources=[{'name':f'US SSA national given names {min(years)}–{max(years)}','file':'ssa-names.zip','url':'https://www.ssa.gov/oact/babynames/names.zip','licence':'CC0 1.0','count':len(given)}]
    surnames=set()
    for file,target,label in [('census2020-first.xlsx',given,'FirstNames_Sex'),('census2020-last.xlsx',surnames,'LastNames_RaceHispanic')]:
        values=census_names(directory/file);target.update(values)
        sources.append({'name':'US Census 2020 '+('given names' if target is given else 'surnames')+' (released 2026-04-14)','file':file,'url':f'https://www2.census.gov/topics/genealogy/2020surnames/Names2020_{label}.xlsx','licence':'US government aggregate data','count':len(values)})
    for file,target,field in [('uk-forenames.csv',given,'Forename'),('uk-surnames.csv',surnames,'Surname')]:
        with (directory/file).open(encoding='utf-8-sig',newline='') as stream:
            values={value for row in csv.DictReader(stream) if (value:=normalise(row[field]))}
        target.update(values)
        sources.append({'name':'UK DfE Autumn School Census 2014 top 1,000 '+field.lower()+'s','file':file,'url':'https://github.com/matt40k/Names/blob/34d163a5c99aa0581ad5d4965d51bf53dd9d78b4/'+('Forename_Autumn2014.csv' if field=='Forename' else 'Surname_Autumn2014.csv'),'licence':'Open Government Licence v3.0; contains public sector information licensed under the OGL v3.0.','count':len(values)})
    for source in sources:source['sha256']=hashlib.sha256((directory/source['file']).read_bytes()).hexdigest()
    return {'metadata':{'version':'rbc-sourced-20261014-1','updated':updated,'description':'Published aggregate names, deduplicated without invented spelling variants. Names only; no individual records or demographic fields.','normalisation':'Lowercase, whitespace normalised, Latin diacritics and curly apostrophes folded for matching; source document text is unchanged.','counts':{'givenNames':len(given),'surnames':len(surnames),'total':len(given)+len(surnames)},'sources':sources},'givenNames':sorted(given),'surnames':sorted(surnames)}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--updated',default='2026-10-14');args=parser.parse_args()
    result=build(args.source_dir,args.updated)
    assert max(len(result['givenNames']),len(result['surnames']))<=200000
    data=json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n'
    assert len(data.encode('utf-8'))<=6_000_000
    args.output.write_text(data,encoding='utf-8');print(json.dumps({'counts':result['metadata']['counts'],'bytes':len(data.encode('utf-8'))}))
