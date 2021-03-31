const webpack = require("webpack")
const path = require("path");

module.exports = {
    entry: "./src/index.ts",
    mode: "development",
    node: false,
    output: {
        path: path.resolve(__dirname, "web-dist"),
        library: "eio",
        libraryTarget: "umd",
        filename: "web.js",
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "ts-loader"
            },
            {
                test: /\.worker.ts$/,
                use: [
                    {
                        loader: "worker-loader",
                        options: {
                            inline: "fallback",
                        },
                    },
                    "ts-loader"
                ],
            },
        ]
    },
    resolve: {
        extensions: [".ts", ".js"]
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
        new webpack.NormalModuleReplacementPlugin(
            /\.\/worker-context-constructor/,
            "./worker-context-constructor.browser"
        ),
    ],
};
