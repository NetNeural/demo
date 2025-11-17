-- Check cron job status
SELECT jobid, jobname, schedule, active, command 
FROM cron.job 
WHERE jobname = 'auto-sync-cron-job';

-- Check recent cron runs
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-cron-job')
ORDER BY start_time DESC
LIMIT 5;

-- Check pg_net request queue
SELECT id, url, method, headers, body, timeout_milliseconds, created
FROM net.http_request_queue
ORDER BY created DESC
LIMIT 3;
