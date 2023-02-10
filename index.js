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
// const token = "sQEPdlxGFA2rCGpNn1Qn_NdyJOXTrCPyw5VpEeuIvtSq5fAhrbalt5PN770taaGItwXh4kulerPoAt8VwJtK6g=="
// const bucket = "sarvesh_test"
// const org = "Onsrud"
// const url = "http://18.118.218.115:8086/"

//local DB on MVR30 brick info
const token = "NJeGVVvav8f2dp4q4Gxn00mE02KZvD0-R3WAIeRLQ1yxPJgkrb8PxMmRorAArft4WFWeN8DYD39KMIs5K1Qgxg=="
const bucket = "145G-TEST"
const org = "CRO"
const url = "http://192.168.1.234:8086/"





const client = new InfluxDB({ url, token })
const queryClient = client.getQueryApi(org)

var genInfoQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Gen Info")
  |> last()`

var postionInfoQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Absolute Postion Info")
  |> last()`

var activeCodesQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Active Codes")
  |> last()`


var alarmsAndMessagesQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Alarms and Messages")
  |> last()`


var axisLoadsQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Axis Loads")
  |> last()`


var axisVoltagesQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Axis Voltages")
  |> last()`


var encoderTempsQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Encoder Temps")
  |> last()`


var motorTempsQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Motor Temps")
  |> last()`

var toolDataQuery = `from(bucket: "${bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "Tool Data")
  |> last()`

var dailyPartCountQuery = `from(bucket: "${bucket}") 
  |> range(start: today())
  |> filter(fn: (r) => r["_measurement"] == "Gen Info")
  |> filter(fn: (r) => r["_field"] == "Parts Counter")`

var dailyRunTimeQuery = `from(bucket: "${bucket}") 
  |> range(start: today())
  |> filter(fn: (r) => r["_measurement"] == "Gen Info")
  |> filter(fn: (r) => r["_field"] == "Run Time")`

var dailyAvailableTime = `from(bucket: "${bucket}") 
  |> range(start: today())
  |> filter(fn: (r) => r["_measurement"] == "Gen Info")
  |> filter(fn: (r) => r["_field"] == "Machine Hours")`



app.get('/', (req, res) => {
    res.send('Please direct your query to a subdirectory')
})

app.get('/gen-info', (req, res) => {
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
            res.send(retArr)
        }
    })
})

app.get('/absolute-positions', (req, res) => {
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

app.get('/active-codes/', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(activeCodesQuery, {
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

app.get('/alarms-and-messages', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(alarmsAndMessagesQuery, {
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

app.get('/axis-loads', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(axisLoadsQuery, {
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

app.get('/axis-voltages', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(axisVoltagesQuery, {
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

app.get('/encoder-temps', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(encoderTempsQuery, {
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

app.get('/motor-temps', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(motorTempsQuery, {
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

app.get('/tool-data', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(toolDataQuery, {
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


app.get('/daily/parts-count', (req, res) => {
    let tableObject;
    let retArr = [];
    queryClient.queryRows(dailyPartCountQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject);
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {
            let firstObject = retArr[0];
            let lastObject = retArr[retArr.length - 1];
            let count = lastObject._value - firstObject._value;
            let toSend = { value: count }
            res.send(toSend)
        }
    })
})

app.get('/daily/run-time', (req, res) => {
    let tableObject;
    let retArr = [];
    let totalRunTimeMinutes;


    queryClient.queryRows(dailyRunTimeQuery, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject);
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {

            let firstObject = retArr[0];
            let lastObject = retArr[retArr.length - 1];
            totalRunTimeMinutes = lastObject._value - firstObject._value; 
            res.send({value:totalRunTimeMinutes})          
        }
    })
})

app.get('/daily/available-time', (req, res) => {
    let tableObject;
    let retArr = [];
    let totalAvailableTime;


    queryClient.queryRows(dailyAvailableTime, {
        next: (row, tableMeta) => {
            tableObject = tableMeta.toObject(row)
            retArr.push(tableObject);
        },
        error: (error) => {
            console.log(error)
        },
        complete: () => {

            let firstObject = retArr[1];
            let lastObject = retArr[retArr.length - 1];
            totalAvailableTime = lastObject._value - firstObject._value; 
            res.send({value:totalAvailableTime})          
        }
    })
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})


