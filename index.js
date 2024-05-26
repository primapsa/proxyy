import express from 'express';
import cors from 'cors';
import proxy from 'express-http-proxy';
import requestIp from 'request-ip';
import { LRUCache } from 'lru-cache';

const app = express();
const port = process.env.PORT || 3001;

const cookiePerIP = new LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 3, // 3 min
    updateAgeOnGet: false,
    updateAgeOnHas: false,
});

app.use(cors({
    origin: true,
}));

app.use(requestIp.mw());


app.use((req, res, next) => {
    const authToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhMThlZjVjOTFjNDkzNDA5NGY2ZTk3YzUzNDEwYjQ1MyIsInN1YiI6IjY2M2Y5NmVjMTMyNzIxZjUxODIxMGJjNSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.MHRIcWru0tXRfowkGqX1dJnfJoTCMAnKn3WDWY5ilYQ';
    req.headers['authorization'] = `Bearer ${authToken}`;
    next();
});

app.use('/', proxy('https://api.themoviedb.org/3', {
    https: true,
    userResHeaderDecorator(headers, userReq, userRes, proxyReq, proxyRes) {
        const key = userReq.clientIp;

        if (headers['set-cookie']) {
            const newCookies = headers['set-cookie'].map(c => {
                const [key, value] = c.split(';')[0].split('=');
                return { key, value };
            });

            const previousCookies = cookiePerIP.get(key) || [];
            const currentCookies = previousCookies.concat(newCookies);

            cookiePerIP.set(key, currentCookies);
        }

        return headers;
    },
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        const key = srcReq.clientIp;

        if (cookiePerIP.has(key)) {
            const cookies = cookiePerIP
                .get(key)
                .map(c => `${c.key}=${c.value}`)
                .join(';');

            proxyReqOpts.headers['cookie'] = cookies;
        }

        const authToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhMThlZjVjOTFjNDkzNDA5NGY2ZTk3YzUzNDEwYjQ1MyIsInN1YiI6IjY2M2Y5NmVjMTMyNzIxZjUxODIxMGJjNSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.MHRIcWru0tXRfowkGqX1dJnfJoTCMAnKn3WDWY5ilYQ';

        proxyReqOpts.headers['authorization'] = `Bearer ${authToken}`;

        return proxyReqOpts;
    },
}));

app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).send('Server error');
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
