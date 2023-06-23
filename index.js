import { InfluxDB } from '@influxdata/influxdb-client'
import bodyParser from 'body-parser'
import express from 'express'
const app = express()
app.use(async function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
const jsonParser = bodyParser.json()
const port = 3001

function createQueryClient(url, token, org) {
    const client = new InfluxDB({ url, token })
    const queryClient = client.getQueryApi(org)
    return queryClient
}


//cloud bucket
const token = "_Vjg-EobTLO-PRE2_7oed8kI9tL3mA6gTMMClcq2Gu0J5orMD_ilTZ0oTtJVNS4fStULh3nYB0BEsNb6gDej2Q==";
const org = "Onsrud";
const url = "http://3.15.33.121:8086";



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
    var startTime = (new Date((Date.parse(req.params['time'])) - (5 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (5 * 60 * 1000))).toISOString();


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
    var startTime = (new Date((Date.parse(req.params['time'])) - (10 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (5 * 60 * 1000))).toISOString();


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
    var startTime = (new Date((Date.parse(req.params['time'])) - (5 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (5 * 60 * 1000))).toISOString();


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
    var startTime = (new Date((Date.parse(req.params['time'])) - (.15 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (.15 * 60 * 1000))).toISOString();


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

app.get('/alarms-details-progam-details/:bucket/:time/', (req, res) => {
    let bucket = req.params['bucket'];
    var startTime = (new Date((Date.parse(req.params['time'])) - (3 * 60 * 1000))).toISOString();
    var endTime = (new Date((Date.parse(req.params['time'])) + (3 * 60 * 1000))).toISOString();


    var programQuery = `from(bucket: "${bucket}")
    |> range(start: ${startTime}, stop: ${endTime})
    |> filter(fn: (r) => r["_measurement"] == "Gen Info")
    |> filter(fn: (r) => r["_field"] == "Program Line")`


    let tableObject;
    let retArr = [];
    queryClient.queryRows(programQuery, {
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

app.post('/email-info/', jsonParser, (req, res) => {
    const TWODAYSAGO = (new Date(Date.now() - 172800000).toISOString().split('T')[0]).toString();
    const YESTERDAY = (new Date(Date.now() - 86400000).toISOString().split('T')[0]).toString();
    const TODAY = (new Date().toISOString().split('T')[0]).toString();
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const buckets = req.body.buckets;
    const queryClient = createQueryClient(url, userToken, userOrg)
    console.log(req.body)


    aggregateData(buckets)

    async function aggregateData(buckets) {
        const unstructuredMachineHoursYesterday = [];
        const unstructuredMachineHoursTwoDaysAgo = [];

        const unstructuredRunTimeYesterday = [];
        const unstructuredRunTimeTwoDaysAgo = [];

        const unstructuredCycleTimeYesterday = [];
        const unstructuredCycleTimeTwoDaysAgo = [];

        let unstructuredPartProductionYesterday = [];
        let unstructuredPartProductionTwoDaysAgo = [];
        let structuredReturnData = [];
        for (const bucket of buckets) {
            try {
                const yesterdaysRetMH = await getMachineHoursData(bucket,YESTERDAY,TODAY)
                const twoDaysAgoRetMH = await getMachineHoursData(bucket,TWODAYSAGO,YESTERDAY)
                unstructuredMachineHoursYesterday.push(yesterdaysRetMH)
                unstructuredMachineHoursTwoDaysAgo.push(yesterdaysRetMH)


                const retRT = await getRunTimeData(bucket,YESTERDAY,TODAY)
                const twoDaysAgoRetRT = await getRunTimeData(bucket,TWODAYSAGO,YESTERDAY)                
                unstructuredRunTimeYesterday.push(retRT)
                unstructuredRunTimeTwoDaysAgo.push(twoDaysAgoRetRT)

                const retCT = await getCycleTimeData(bucket,YESTERDAY,TODAY)
                const twoDaysAgoRetCT = await getCycleTimeData(bucket,TWODAYSAGO,YESTERDAY)

                const retPP = await getPartProductionData(bucket, YESTERDAY, TODAY)
                const twoDaysAgoRetPP = await getPartProductionData(bucket, TWODAYSAGO, YESTERDAY)                
                unstructuredPartProductionYesterday.push(retPP)
                unstructuredPartProductionTwoDaysAgo.push(twoDaysAgoRetPP)

                let productivityYesterday = calculateProductivity(retRT, yesterdaysRetMH)
                let productivityTwoDaysAgo = calculateProductivity(twoDaysAgoRetRT, twoDaysAgoRetMH)

                let totalOnTimeYesterday = calculateMachineHoursTotal(yesterdaysRetMH)
                let totalOnTimeTwoDaysAgo = calculateMachineHoursTotal(twoDaysAgoRetMH)

                let totalCycleTimeYesterday = calculateTotalCycleTime(retCT)
                let totalCycleTimeTwoDaysAgo = calculateTotalCycleTime(twoDaysAgoRetCT)

                let averageCycleTimeYesterday = calculateAverageCycleTime(retCT)
                let averageCycleTimeTwoDaysAgo = calculateAverageCycleTime(twoDaysAgoRetCT)

                let partsProducedYesterday = calculatePartsProduced(retPP)
                let partsProducedTwoDaysAgo = calculatePartsProduced(twoDaysAgoRetPP)

                let emailData = {
                    bucket: bucket,
                    productivity: productivityYesterday,
                    totalOnTime: totalOnTimeYesterday,
                    totalCycleTime: totalCycleTimeYesterday,
                    averageCycleTime: averageCycleTimeYesterday,
                    partsProduced: partsProducedYesterday
                }
                structuredReturnData.push(emailData)
            }
            catch (err) {
                console.log(err)
                structuredReturnData.push({ bucket: bucket, error: err })
            }

        }

        res.status(200).send(structuredReturnData)
    }


    async function getMachineHoursData(bucketToGet,start,stop) {
        const machineHoursQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Machine Hours")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;

        const retArr = [];
        const machineHoursRetObj = await queryClient.collectRows(machineHoursQuery)
        console.log(machineHoursRetObj.length)
        for (let i = 0; i < machineHoursRetObj.length; i++) {
            const machineHoursObj = {
                bucket: bucketToGet,
                _field: machineHoursRetObj[i]._field,
                _value: machineHoursRetObj[i]._value,
                _time: machineHoursRetObj[i]._time
            }
            retArr.push(machineHoursObj)
        }

        return retArr
    }
    async function getRunTimeData(bucketToGet,start,stop) {
        const runTimeQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Run Time")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
        const retArr = [];
        const runTimeRetObj = await queryClient.collectRows(runTimeQuery)
        for (let i = 0; i < runTimeRetObj.length; i++) {
            const runTimeObj = {
                bucket: bucketToGet,
                _field: runTimeRetObj[i]._field,
                _value: runTimeRetObj[i]._value,
                _time: runTimeRetObj[i]._time,
            }
            retArr.push(runTimeObj)
        }
        return retArr
    }
    async function getCycleTimeData(bucketToGet,start,stop) {
        const cycleTimeQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Cycle Time")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
        const retArr = [];
        const cycleTimeRetObj = await queryClient.collectRows(cycleTimeQuery)
        for (let i = 0; i < cycleTimeRetObj.length; i++) {
            const cycleTimeObj = {
                bucket: bucketToGet,
                _field: cycleTimeRetObj[i]._field,
                _value: cycleTimeRetObj[i]._value,
                _time: cycleTimeRetObj[i]._time,
            }
            retArr.push(cycleTimeObj)
        }
        return retArr
    }
    async function getPartProductionData(bucketToGet,start,stop) {
        const partProductionQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Parts Counter")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
        const retArr = [];
        const partProductionRetObj = await queryClient.collectRows(partProductionQuery)
        for (let i = 0; i < partProductionRetObj.length; i++) {
            const partProductionObj = {
                bucket: bucketToGet,
                _field: partProductionRetObj[i]._field,
                _value: partProductionRetObj[i]._value,
                _time: partProductionRetObj[i]._time,
            }
            retArr.push(partProductionObj)
        }
        return retArr
    }




    function calculateTotalCycleTime(cycleTimesArray) {
        let totalInSeconds = 0;
        let secondsArray = [];
        if (cycleTimesArray.length === 0) {
            return 0
        }
        if (cycleTimesArray.length === 1) {
            return cycleTimesArray[0]._value
        }
        for (let i = 0; i < cycleTimesArray.length; i++) {

            if (i === cycleTimesArray.length - 1 && secondsArray.length === 0) {
                return cycleTimesArray[i]._value
            }


            if (i !== 0 && cycleTimesArray[i]._value < cycleTimesArray[i - 1]._value) {
                //turn the cycle time into seconds
                secondsArray.push(Math.round((Math.floor(cycleTimesArray[i - 1]._value) * 60) + ((cycleTimesArray[i - 1]._value % 1) * 100)))
            }
        }
        for (let i = 0; i < secondsArray.length; i++) {
            totalInSeconds += secondsArray[i]
        }

        const hours = Math.floor(totalInSeconds / 60 / 60);
        const minutes = Math.floor(totalInSeconds / 60) - (hours * 60);
        const seconds = totalInSeconds % 60;
        if (hours === 0 && minutes === 0) {
            return seconds + "s";
        } else if (hours === 0) {
            return minutes + "m " + seconds + "s";
        } else {
            return hours + "h " + minutes + "m " + seconds + "s";
        }
    }
    function calculateAverageCycleTime(cycleTimesArray) {
        let totalInSeconds = 0;
        let secondsArray = [];
        let averageInSeconds = 0;
        if (cycleTimesArray.length === 0) {
            return 0
        }
        if (cycleTimesArray.length === 1) {
            return cycleTimesArray[0]._value
        }
        for (let i = 0; i < cycleTimesArray.length; i++) {

            if (i === cycleTimesArray.length - 1 && secondsArray.length === 0) {
                return cycleTimesArray[i]._value
            }


            if (i !== 0 && cycleTimesArray[i]._value < cycleTimesArray[i - 1]._value) {
                //turn the cycle time into seconds
                secondsArray.push(Math.round((Math.floor(cycleTimesArray[i - 1]._value) * 60) + ((cycleTimesArray[i - 1]._value % 1) * 100)))
            }
        }
        for (let i = 0; i < secondsArray.length; i++) {
            totalInSeconds += secondsArray[i]
        }
        averageInSeconds = Math.floor(totalInSeconds / secondsArray.length)

        const hours = Math.floor(averageInSeconds / 60 / 60);
        const minutes = Math.floor(averageInSeconds / 60) - (hours * 60);
        const seconds = averageInSeconds % 60;
        if (hours === 0 && minutes === 0) {
            return seconds + "s";
        } else if (hours === 0) {
            return minutes + "m " + seconds + "s";
        } else {
            return hours + "h " + minutes + "m " + seconds + "s";
        }
    }
    function calculateProductivity(runTimesArray, machineHoursArray) {
        if (runTimesArray.length === 0 || machineHoursArray.length === 0) {
            return 0
        }
        if (runTimesArray.length === 1 || machineHoursArray.length === 1) {
            return 0
        }
        let runTimeTotal = runTimesArray[runTimesArray.length - 1]._value - runTimesArray[0]._value;
        let machineHoursTotal = machineHoursArray[machineHoursArray.length - 1]._value - machineHoursArray[0]._value;
        let productivityValue = runTimeTotal / machineHoursTotal;
        return Math.round(((productivityValue.toFixed(2)) * 100));
    }
    function calculateMachineHoursTotal(machineHoursArray) {
        if (machineHoursArray.length === 0) {
            return 0
        }
        if (machineHoursArray.length === 1) {
            return 0
        }
        let machineHoursTotal = machineHoursArray[machineHoursArray.length - 1]._value - machineHoursArray[0]._value;
        const hours = Math.floor(machineHoursTotal / 60);
        const minutes = Math.floor(machineHoursTotal % 60);
        if (hours === 0) {
            return minutes + "m";
        } else {
            return hours + "h " + minutes + "m";
        }
    }
    function calculatePartsProduced(partProductionArray) {
        if (partProductionArray.length === 0) {
            return 0
        }
        if (partProductionArray.length === 1) {
            return 1
        }
        let partsProducedTotal = partProductionArray[partProductionArray.length - 1]._value - partProductionArray[0]._value;
        return partsProducedTotal;
    }

})


app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})



