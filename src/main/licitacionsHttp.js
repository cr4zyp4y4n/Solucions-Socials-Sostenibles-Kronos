const http = require('http');
const https = require('https');
const zlib = require('node:zlib');

const LICITACIONS_HTTP_HOSTS = new Set([
  'api.ted.europa.eu',
  'opendata.aoc.cat',
  'analisi.transparenciacatalunya.cat',
  'contrataciondelestado.es',
  'www.contrataciondelestado.es'
]);

/** Sin timeout el sync se cuelga. PLACSP Completo3 ~4MB necesita más de 25s. */
const DEFAULT_TIMEOUT_MS = 25000;
const PLACSP_TIMEOUT_MS = 90000;

function timeoutForUrl(url, explicit) {
  if (Number(explicit) > 0) return Number(explicit);
  try {
    const host = new URL(url).hostname;
    if (host === 'contrataciondelestado.es' || host === 'www.contrataciondelestado.es') {
      return PLACSP_TIMEOUT_MS;
    }
  } catch (_) {
    // ignore
  }
  return DEFAULT_TIMEOUT_MS;
}

function licitacionsHttpRequest({ url, method = 'GET', headers = {}, body = null, timeoutMs = null }) {
  return new Promise((resolve, reject) => {
    const MAX_REDIRECTS = 5;
    const limitMs = timeoutForUrl(url, timeoutMs);
    let settled = false;
    let activeReq = null;
    let timer = null;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        activeReq?.destroy?.();
      } catch (_) {
        // ignore
      }
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const succeed = (payload) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(payload);
    };

    timer = setTimeout(() => {
      fail(new Error(`Timeout licitacions HTTP (${limitMs}ms): ${url}`));
    }, limitMs);

    const doRequest = (currentUrl, redirectsLeft) => {
      let urlObj;
      try {
        urlObj = new URL(currentUrl);
      } catch (e) {
        fail(e);
        return;
      }
      if (!LICITACIONS_HTTP_HOSTS.has(urlObj.hostname)) {
        fail(new Error(`Host no permès per a licitacions: ${urlObj.hostname}`));
        return;
      }

      const lib = urlObj.protocol === 'http:' ? http : https;
      const baseHeaders = {
        'User-Agent': 'SSS-Kronos/licitacions (+electron)',
        Accept: headers.Accept || headers.accept || '*/*',
        'Accept-Language': headers['Accept-Language'] || headers['accept-language'] || 'es-ES,es;q=0.9,ca;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip,deflate',
        ...headers
      };

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method || 'GET',
        headers: baseHeaders,
        timeout: limitMs
      };

      const req = lib.request(requestOptions, (res) => {
        const sc = res.statusCode || 0;
        const isRedirect = sc >= 300 && sc < 400 && !!res.headers.location;
        if (isRedirect) {
          if (redirectsLeft <= 0) {
            res.resume();
            fail(new Error('Demasiadas redirecciones en licitacions-http-request'));
            return;
          }
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, currentUrl).toString();
          res.resume();
          doRequest(nextUrl, redirectsLeft - 1);
          return;
        }

        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        const contentType = String(res.headers['content-type'] || '');

        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);

          const finish = (buf) => succeed({
            ok: sc >= 200 && sc < 300,
            status: sc,
            statusText: res.statusMessage,
            text: buf.toString('utf8'),
            headers: {
              'content-type': contentType,
              'content-encoding': encoding
            }
          });

          if (encoding === 'gzip') {
            zlib.gunzip(buffer, (err, out) => {
              if (err) {
                finish(buffer);
                return;
              }
              finish(out);
            });
            return;
          }

          if (encoding === 'deflate') {
            zlib.inflate(buffer, (err, out) => {
              if (err) {
                finish(buffer);
                return;
              }
              finish(out);
            });
            return;
          }

          finish(buffer);
        });
      });

      activeReq = req;

      req.on('timeout', () => {
        fail(new Error(`Timeout licitacions HTTP (${limitMs}ms): ${currentUrl}`));
      });

      req.on('error', (error) => {
        fail(new Error(`Request failed: ${error.message}`));
      });

      if (body != null && body !== '') {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    };

    doRequest(url, MAX_REDIRECTS);
  });
}

module.exports = { licitacionsHttpRequest, LICITACIONS_HTTP_HOSTS };
