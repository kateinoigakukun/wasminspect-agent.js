const webpack = require("webpack")
const path = require('path');

module.exports = {
    entry: "./src/index.ts",
    mode: "development",
    node: false,
    output: {
        path: path.resolve(__dirname, "web-dist"),
        filename: "web.js",
    },
    module: {
        rules: [
            {
                test: /\.worker\.ts$/,
                loader: "worker-loader",
                options: {
                    inline: "fallback",
                },
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            },
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    plugins: [
        new webpack.NormalModuleReplacementPlugin(
            /\.\/websocket-constructor/,
            "./websocket-constructor.browser"
        ),
        new webpack.NormalModuleReplacementPlugin(
            /\.\/worker-constructor/,
            "./worker-constructor.browser"
        ),
    ],
};
