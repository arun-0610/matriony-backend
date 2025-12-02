
// Scheduler for: 1) mark inactive users after 1 month of no login -> delete and notify one week prior
// This module receives a 'pool' (pg) and sets up periodic checks using setInterval (demo).
// In production use node-cron or agenda with robust job processing.
module.exports.scheduleJobs = function(pool){
  console.log('Scheduler: starting periodic cleanup checks (demo every hour)');
  setInterval(async ()=>{
    try {
      // find users with last_login older than 23 days (notify) and 30 days (delete)
      const notifyQ = `SELECT id,email,last_login FROM users WHERE status='active' AND last_login < NOW() - INTERVAL '23 days'`;
      const delQ = `SELECT id,email FROM users WHERE last_login < NOW() - INTERVAL '30 days'`;
      const notifyRes = await pool.query(notifyQ);
      for (const row of notifyRes.rows){
        // send reminder email - implement your email util
        console.log('Would notify user before deletion:', row.email);
      }
      const delRes = await pool.query(delQ);
      for (const row of delRes.rows){
        console.log('Would delete user:', row.id);
        await pool.query('DELETE FROM users WHERE id=$1', [row.id]);
      }
    } catch(e){ console.error('scheduler error',e); }
  }, 1000 * 60 * 60); // runs every hour in this demo
};
