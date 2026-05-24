<!DOCTYPE html>
<html>
<head>
    <title>Transcribe</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 24px;
            max-width: 950px;
        }

        h2 {
            margin-bottom: 12px;
        }

        .controls {
            margin-bottom: 16px;
        }

        button {
            margin: 4px 4px 4px 0;
            padding: 6px 12px;
            cursor: pointer;
        }

        #status {
            margin: 12px 0;
            font-weight: bold;
        }

        #job-info {
            margin: 8px 0 12px 0;
            color: #555;
            font-size: 0.95em;
        }

        #progress-wrap {
            width: 100%;
            background: #e5e5e5;
            border-radius: 8px;
            overflow: hidden;
            height: 22px;
            margin: 8px 0 16px 0;
            display: none;
        }

        #progress-bar {
            width: 0%;
            height: 100%;
            background: #555;
            color: white;
            text-align: center;
            line-height: 22px;
            font-size: 13px;
            transition: width 0.3s ease;
        }

        #result {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 14px;
            white-space: pre-wrap;
            min-height: 220px;
        }

        .hint {
            color: #555;
            font-size: 0.9em;
            margin-top: 8px;
        }

        #recent-jobs {
            margin-top: 20px;
            font-size: 0.9em;
        }

        #recent-jobs ul {
            padding-left: 18px;
        }

        #recent-jobs li {
            margin-bottom: 5px;
        }

        .small {
            font-size: 0.9em;
        }
    </style>
</head>
<body>

<h2>Upload audio for transcription</h2>

<div class="controls">
    <input type="file" id="file" accept="audio/*">
    <button onclick="go()">Transcribe</button>
    <button onclick="resumeLatestJob()">Resume latest job</button>
    <button onclick="clearCurrentJob()">Clear current job</button>
</div>

<div id="status">Waiting...</div>
<div id="job-info"></div>

<div id="progress-wrap">
    <div id="progress-bar">0%</div>
</div>

<pre id="result"></pre>

<div class="hint">
    Longer files may take several minutes on the Raspberry Pi. If you refresh this page, the latest job should resume automatically.
</div>

<div id="recent-jobs">
    <strong>Recent jobs</strong>
    <ul id="recent-list"></ul>
</div>

<script>
let pollTimer = null;

const STORAGE_ACTIVE_JOB = "transcribe.activeJobId";
const STORAGE_RECENT_JOBS = "transcribe.recentJobs";

function saveActiveJob(jobId) {
    localStorage.setItem(STORAGE_ACTIVE_JOB, jobId);
    addRecentJob(jobId);
}

function getActiveJob() {
    return localStorage.getItem(STORAGE_ACTIVE_JOB) || "";
}

function clearActiveJob() {
    localStorage.removeItem(STORAGE_ACTIVE_JOB);
}

function getRecentJobs() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_RECENT_JOBS) || "[]");
    } catch {
        return [];
    }
}

function saveRecentJobs(jobs) {
    localStorage.setItem(STORAGE_RECENT_JOBS, JSON.stringify(jobs.slice(0, 10)));
}

function addRecentJob(jobId) {
    let jobs = getRecentJobs();

    jobs = jobs.filter(j => j.id !== jobId);

    jobs.unshift({
        id: jobId,
        started: new Date().toLocaleString()
    });

    saveRecentJobs(jobs);
    renderRecentJobs();
}

function renderRecentJobs() {
    const list = document.getElementById("recent-list");
    const jobs = getRecentJobs();

    list.innerHTML = "";

    if (!jobs.length) {
        const li = document.createElement("li");
        li.textContent = "No recent jobs saved in this browser.";
        list.appendChild(li);
        return;
    }

    jobs.forEach(job => {
        const li = document.createElement("li");

        const button = document.createElement("button");
        button.textContent = "Open";
        button.className = "small";
        button.onclick = () => startPolling(job.id);

        const span = document.createElement("span");
        span.textContent = " " + job.id + " (" + job.started + ")";

        li.appendChild(button);
        li.appendChild(span);
        list.appendChild(li);
    });
}

function parseStatusResponse(text) {
    const lines = text.split(/\r?\n/);

    let status = "UNKNOWN";
    let current = 0;
    let total = 0;
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("STATUS:")) {
            status = line.substring("STATUS:".length).trim();
            continue;
        }

        if (line.startsWith("CURRENT:")) {
            current = parseInt(line.substring("CURRENT:".length).trim(), 10) || 0;
            continue;
        }

        if (line.startsWith("TOTAL:")) {
            total = parseInt(line.substring("TOTAL:".length).trim(), 10) || 0;
            continue;
        }

        if (line.trim() === "") {
            bodyStart = i + 1;
            break;
        }
    }

    const body = lines.slice(bodyStart).join("\n").trim();

    return { status, current, total, body };
}

function updateProgress(current, total, status) {
    const wrap = document.getElementById("progress-wrap");
    const bar = document.getElementById("progress-bar");

    wrap.style.display = "block";

    let percent = 0;

    if (total > 0) {
        percent = Math.min(100, Math.round((current / total) * 100));
    } else if (status === "PROCESSING") {
        percent = 5;
    } else if (status === "DONE") {
        percent = 100;
    }

    bar.style.width = percent + "%";
    bar.innerText = percent + "%";
}

async function go() {
    const fileInput = document.getElementById("file");
    const result = document.getElementById("result");
    const statusBox = document.getElementById("status");

    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    if (!fileInput.files.length) {
        statusBox.innerText = "Please select a file.";
        return;
    }

    const file = fileInput.files[0];

    statusBox.innerText = "Uploading...";
    result.innerText = "";
    document.getElementById("job-info").innerText = "";

    updateProgress(0, 0, "PROCESSING");

    let jobId = "";

    try {
        const upload = await fetch("/transcribe", {
            method: "POST",
            body: file
        });

        jobId = (await upload.text()).trim();

        if (!jobId || jobId.length < 10 || jobId.includes("<")) {
            statusBox.innerText = "Upload failed: invalid job ID returned.";
            result.innerText = jobId;
            return;
        }

    } catch (err) {
        statusBox.innerText = "Upload failed.";
        result.innerText = String(err);
        return;
    }

    saveActiveJob(jobId);
    startPolling(jobId);
}

function resumeLatestJob() {
    const jobId = getActiveJob();

    if (!jobId) {
        document.getElementById("status").innerText = "No saved active job found in this browser.";
        return;
    }

    startPolling(jobId);
}

function clearCurrentJob() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    clearActiveJob();

    document.getElementById("status").innerText = "Current job cleared.";
    document.getElementById("job-info").innerText = "";
    document.getElementById("result").innerText = "";
    document.getElementById("progress-wrap").style.display = "none";
}

function startPolling(jobId) {
    const result = document.getElementById("result");
    const statusBox = document.getElementById("status");
    const jobInfo = document.getElementById("job-info");

    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    saveActiveJob(jobId);

    statusBox.innerText = "Resuming job...";
    jobInfo.innerText = "Job ID: " + jobId;

    async function poll() {
        try {
            const res = await fetch(
                "/transcribe-status?ID=" + encodeURIComponent(jobId) + "&nocache=" + Date.now(),
                { cache: "no-store" }
            );

            const raw = await res.text();
            const parsed = parseStatusResponse(raw);

            updateProgress(parsed.current, parsed.total, parsed.status);

            if (parsed.status === "PROCESSING") {
                if (parsed.total > 0) {
                    statusBox.innerText =
                        "Processing: " + parsed.current + " of " + parsed.total + " chunks complete";
                } else {
                    statusBox.innerText = "Preparing audio...";
                }

                result.innerText = parsed.body || "Preparing audio and looking for pauses...";
                return;
            }

            if (parsed.status === "DONE") {
                statusBox.innerText = "Complete";
                updateProgress(parsed.total || 1, parsed.total || 1, "DONE");
                result.innerText = parsed.body || "(completed but no transcript was produced)";

                clearInterval(pollTimer);
                pollTimer = null;

                // Keep the job saved so refresh still shows it,
                // but it is no longer actively polling.
                saveActiveJob(jobId);
                return;
            }

            if (parsed.status === "ERROR") {
                statusBox.innerText = "Error";
                result.innerText = parsed.body || raw;

                clearInterval(pollTimer);
                pollTimer = null;
                return;
            }

            statusBox.innerText = "Unknown response";
            result.innerText = raw;

        } catch (err) {
            statusBox.innerText = "Polling error, retrying...";
            console.error(err);
        }
    }

    poll();
    pollTimer = setInterval(poll, 3000);
}

window.addEventListener("load", () => {
    renderRecentJobs();

    const activeJob = getActiveJob();

    if (activeJob) {
        document.getElementById("status").innerText =
            "Found saved job. Resuming...";
        startPolling(activeJob);
    }
});
</script>

</body>
</html>
