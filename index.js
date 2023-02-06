import { InfluxDB } from '@influxdata/influxdb-client'
import express from 'express'
const app = express()
const port = 3001

const token = "NJeGVVvav8f2dp4q4Gxn00mE02KZvD0-R3WAIeRLQ1yxPJgkrb8PxMmRorAArft4WFWeN8DYD39KMIs5K1Qgxg=="
const bucket = "145G-TEST"
const org = "CRO"
const url = "http://192.168.1.234:8086/"

const client = new InfluxDB({url,token})
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


app.get('/',  (req, res) => {
    res.send('Please direct your query to a subdirectory')
})

app.get('/gen-info', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(genInfoQuery,{
        next: (row,tableMeta) => {
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

app.get('/absolute-positions', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(postionInfoQuery,{
        next: (row,tableMeta) => {
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


app.get('/active-codes/', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(activeCodesQuery,{
        next: (row,tableMeta) => {
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

app.get('/alarms-and-messages', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(alarmsAndMessagesQuery,{
        next: (row,tableMeta) => {
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

app.get('/axis-loads', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(axisLoadsQuery,{
        next: (row,tableMeta) => {
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

app.get('/axis-voltages', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(axisVoltagesQuery,{
        next: (row,tableMeta) => {
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

app.get('/encoder-temps', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(encoderTempsQuery,{
        next: (row,tableMeta) => {
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

app.get('/motor-temps', (req,res) =>{
    let tableObject;
    let retArr = [];
    queryClient.queryRows(motorTempsQuery,{
        next: (row,tableMeta) => {
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



















app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})


