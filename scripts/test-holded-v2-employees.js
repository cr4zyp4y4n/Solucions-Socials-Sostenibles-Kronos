/**
 * Prueba manual: node scripts/test-holded-v2-employees.js
 * Usa HOLDED_API_KEY en entorno o la key de solucions en holdedHttpClient.
 */
const https = require('https');

const API_KEY = process.env.HOLDED_API_KEY || 'c2c5422f061d6aeda899e3941cbb4b04';

const url = new URL('https://api.holded.com/api/v2/employees?limit=3');

https
  .get(
    {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json'
      }
    },
    (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        console.log('HTTP', res.statusCode);
        try {
          const data = JSON.parse(body);
          console.log(JSON.stringify(data, null, 2).slice(0, 2000));
          if (data.items) console.log('\nitems:', data.items.length, 'has_more:', data.has_more);
        } catch {
          console.log(body.slice(0, 500));
        }
      });
    }
  )
  .on('error', console.error);
