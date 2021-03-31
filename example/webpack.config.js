const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: "./index.js",
    mode: "development",
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "public", to: "./" },
            ],
        }),
    ],
};
