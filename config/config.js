
module.exports = {

    appenders: {
        users: {
            type: "dateFile",
            filename: "./logs/user.log",
            pattern: "-yyyy-MM-dd",
            category: "users",
            maxLogSize: 104857600,
            numBackups: 3
        },
        errorFile: {
            type: "file",
            filename: "./logs/errors.log"
        },
        errors: {
            type: "logLevelFilter",
            level: "ERROR",
            appender: "errorFile"
        }
    },
    categories: {
        default: { appenders: [ "users", "errors" ], level: "DEBUG" },
        server: { appenders: [ "users", "errors"], level: "DEBUG" }
    },

    sqlite3:{
        filename: "aitd.sqlite"
    },

    node:{
        url: 'ws://127.0.0.1:6004'
        // url: 'ws://127.0.0.1:31005'
    }
}