import { InfluxDB } from '@influxdata/influxdb-client'
import express from 'express'
const app = express()
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
const port = 3001

//cloud bucket
const token = "_Vjg-EobTLO-PRE2_7oed8kI9tL3mA6gTMMClcq2Gu0J5orMD_ilTZ0oTtJVNS4fStULh3nYB0BEsNb6gDej2Q==";
const org = "Onsrud";
const url = "http://3.15.33.121:8086";

// const org = "CRO";
// const token = "Ghooo4rBGx61mJpO3wFUduX1jg84TI5wGS6uyjsSEIfMwlTM27KrcgBBXjrXFXEjAwXNyol0LifOeZ5-Bl-_9Q==";


// //local DB
//  const token = "Sgbk6sKLgqN1g-R2a_RiFWFDr8APhnoVkIegzJ-GYPW6jjwCeq5BP4S96QLIGFsvMuazQ9UmjvafWoz96uEaQw=="
//  const org = "Onsrud"
//  const url = "http://192.168.2.2:8086/"





const client = new InfluxDB({ url, token })
const queryClient = client.getQueryApi(org)

var query = `buckets()
|> keep(columns: ["name"])`


app.get('/', (req, res) => {
    res.send('Please direct your query to a subdirectory')
})

app.get('/buckets', (req, res) => {
    var resArr = [];
    var retArry = [];
    queryClient.queryRaw(query)
        .then(result => {
            resArr = result.split('\n');

        })
        .catch(error => {
            console.error('Error listing buckets:', error);
        })
        .then(() => {
            retArry = resArr.slice(4, resArr.length - 4)
            retArry = retArry.map((item) => {
                return item.slice(4, item.length - 1)
            })
            res.send(retArry)
        })
})

app.get('/gen-info/:bucket', (req, res) => {
    let bucket = req.params['bucket'];

    var genInfoQuery = `from(bucket: "${bucket}")
  |> range(start: -30d)
  |> filter(fn: (r) => r["_measurement"] == "Gen Info")
  |> last()`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(genInfoQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject);
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            retArr.push({ _field: "Serial Number", _value: bucket })
            res.send(retArr)
        }
    })
})

app.get('/absolute-positions/:bucket', (req, res) => {
    let bucket = req.params['bucket'];

    var postionInfoQuery = `from(bucket: "${bucket}")
    |> range(start: -24h)
    |> filter(fn: (r) => r["_measurement"] == "Absolute Postion Info")
    |> last()`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(postionInfoQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject);
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send(retArr)
        }
    })
})

app.get('/all-alarms-and-messages/:bucket/:range?', (req, res) => {
    let bucket = req.params['bucket'];
    let range = req.params['range'];
    if (range == undefined) {
        range = "-7d"
    }
    var dailyAlarmQuery = `from(bucket: "${bucket}")
    |> range(start: ${range})
    |> filter(fn: (r) => r["_measurement"] == "Alarms and Messages")`

    let tableObject;
    let messArr = [];
    let alarmArr = [];
    queryClient.queryRows(dailyAlarmQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            if (tableObject._field == "Message") {
                messArr.push(tableObject)
            }
            else if (tableObject._field == "Alarm") {
                alarmArr.push(tableObject)
            }
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send({ messages: messArr, alarms: alarmArr })
        }
    })
})

app.get('/mode-and-status-info/:bucket/:range?', (req, res) => {
    let bucket = req.params['bucket'];
    let range = req.params['range'];
    if (range == undefined) {
        range = "-7d"
    }
    var dailyAlarmQuery = `from(bucket: "${bucket}")
    |> range(start: ${range})
    |> filter(fn: (r) => r["_measurement"] == "Gen Info")
    |> filter(fn: (r) => r["_field"] == "Mode" or r["_field"] == "Status")`

    let tableObject;
    let modeArr = [];
    let statusArr = [];
    queryClient.queryRows(dailyAlarmQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            if (tableObject._field == "Mode") {
                modeArr.push(tableObject)
            }
            else if (tableObject._field == "Status") {
                statusArr.push(tableObject)
            }
        }
        ,
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send({ mode: modeArr, status: statusArr })
        }

    })
})

app.get('/historical-loads-and-temps/:bucket/:range?/', (req, res) => {
    let bucket = req.params['bucket'];
    let range = req.params['range'];
    if (range == undefined) {
        range = "-24h"
    }
    var dailyAlarmQuery = `from(bucket: "${bucket}")
    |> range(start: ${range})
    |> filter(fn: (r) => r["_measurement"] == "Axis Loads" or r["_measurement"] == "Axis Voltages" or r["_measurement"] == "Encoder Temps" or r["_measurement"] == "Motor Temps")`

    let tableObject;
    let loadArr = [];
    let voltArr = [];
    let encTempArr = [];
    let motTempArr = [];
    queryClient.queryRows(dailyAlarmQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            if (tableObject._measurement == "Axis Loads") {
                loadArr.push(tableObject)
            }
            else if (tableObject._measurement == "Axis Voltages") {
                voltArr.push(tableObject)
            }
            else if (tableObject._measurement == "Encoder Temps") {
                encTempArr.push(tableObject)
            }
            else if (tableObject._measurement == "Motor Temps") {
                motTempArr.push(tableObject)
            }
        }
        ,
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send({ loads: loadArr, voltages: voltArr, encoderTemps: encTempArr, motorTemps: motTempArr })
        }
    })
})

app.get('/alarms-details/:bucket/:time/', (req, res) => {
    let bucket = req.params['bucket'];
    var startTime = (new Date((Date.parse(req.params['time'])) - (15 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (15 * 60 * 1000))).toISOString();


    var dailyAlarmQuery = `from(bucket: "${bucket}")
    |> range(start: ${startTime}, stop: ${endTime})
    |> filter(fn: (r) => r["_measurement"] == "Alarms and Messages")`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(dailyAlarmQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject)
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send(retArr)
        }
    })
})

app.get('/alarms-details-sm/:bucket/:time/', (req, res) => {
    let bucket = req.params['bucket'];
    var startTime = (new Date((Date.parse(req.params['time'])) - (15 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (15 * 60 * 1000))).toISOString();


    var smQuery = `from(bucket: "${bucket}")
    |> range(start: ${startTime}, stop: ${endTime})
    |> filter(fn: (r) => r["_measurement"] == "Gen Info")
    |> filter(fn: (r) => r["_field"] == "Mode" or r["_field"] == "Status")`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(smQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject)
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send(retArr)
        }
    })
})

app.get('/alarms-details-lt/:bucket/:time/', (req, res) => {
    let bucket = req.params['bucket'];
    var startTime = (new Date((Date.parse(req.params['time'])) - (15 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (15 * 60 * 1000))).toISOString();


    var smQuery = `from(bucket: "${bucket}")
    |> range(start: ${startTime}, stop: ${endTime})
    |> filter(fn: (r) => r  ["_measurement"] == "Axis Loads" or r["_measurement"] == "Axis Voltages" or r["_measurement"] == "Encoder Temps" or r["_measurement"] == "Motor Temps")`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(smQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject)
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send(retArr)
        }
    })
})

app.get('/alarms-details-os/:bucket/:time/', (req, res) => {
    let bucket = req.params['bucket'];
    var startTime = (new Date((Date.parse(req.params['time'])) - (15 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (15 * 60 * 1000))).toISOString();


    var smQuery = `from(bucket: "${bucket}")
    |> range(start: ${startTime}, stop: ${endTime})
    |> filter(fn: (r) => r["Alarm One Shot"] == "Post-Alarm" or r["Alarm One Shot"] == "Pre-Alarm")`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(smQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject)
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            res.send(retArr)
        }
    })
})



app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})


