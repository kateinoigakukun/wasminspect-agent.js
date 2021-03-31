import typescript from '@rollup/plugin-typescript';
import webWorkerLoader from 'rollup-plugin-web-worker-loader';

export default [
    {
        input: "src/worker-constructor.browser.ts",
        output: {
            dir: "dist",
            format: "cjs",
            exports: "default"
        },
        plugins: [
            webWorkerLoader(),
            typescript()
        ],
    },
]
