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


app.post('/email-info/', jsonParser, (req, res) => {
    const twoDaysAgo = (new Date(Date.now() - 172800000).toISOString().split('T')[0]).toString();
    const yesterday = (new Date(Date.now() - 86400000).toISOString().split('T')[0]).toString();
    const today = (new Date().toISOString().split('T')[0]).toString();
    //const today = (new Date(Date.now() - 259200000).toISOString().split('T')[0]).toString();
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const buckets = req.body.buckets;
    const queryClient = createQueryClient(url, userToken, userOrg)
    console.log(req.body)


    aggregateData(buckets)

    async function aggregateData(buckets) {
        const unstructuredMachineHours = [];
        const unstructuredMachineHoursPrev = [];

        const unstructuredRunTime = [];
        const unstructuredRunTimePrev = [];

        const unstructuredCycleTime = [];
        const unstructuredCycleTimePrev = [];

        let unstructuredPartProduction = [];
        let unstructuredPartProductionPrev = [];
        let structuredReturnData = [];

        for (const bucket of buckets) {
            try {
                const retMachineHours = await getMachineHoursData(bucket, yesterday, today)
                const previousRetMachineHours = await getMachineHoursData(bucket, twoDaysAgo, yesterday, true)
                unstructuredMachineHours.push(retMachineHours)
                unstructuredMachineHoursPrev.push(previousRetMachineHours)


                const retRunTime = await getRunTimeData(bucket, yesterday, today)
                const previousRetRunTime = await getRunTimeData(bucket, twoDaysAgo, yesterday, true)
                unstructuredRunTime.push(retRunTime)
                unstructuredRunTimePrev.push(previousRetRunTime)

                const retCycleTime = await getCycleTimeData(bucket, yesterday, today)
                const preiviousRetCycleTime = await getCycleTimeData(bucket, twoDaysAgo, yesterday, true)
                unstructuredCycleTime.push(retCycleTime)
                unstructuredCycleTimePrev.push(preiviousRetCycleTime)

                const retPartsProduced = await getPartProductionData(bucket, yesterday, today)
                const previousRetPartsProduced = await getPartProductionData(bucket, twoDaysAgo, yesterday, true)
                unstructuredPartProduction.push(retPartsProduced)
                unstructuredPartProductionPrev.push(previousRetPartsProduced)

                let cycleTimeObj = calculateCycleTimeObj(retCycleTime, preiviousRetCycleTime)

                let productivityObj = calculateProductivity(retRunTime, retMachineHours, previousRetRunTime, previousRetMachineHours)

                let totalOnTimeObj = calculateMachineHoursTotal(retMachineHours, previousRetMachineHours)

                let partsProducedObj = calculatePartsProduced(retPartsProduced, previousRetPartsProduced)


                let emailData = {
                    bucket: bucket,
                    productivity: productivityObj,
                    totalOnTime: totalOnTimeObj,
                    cycleTime: cycleTimeObj,
                    partsProduced: partsProducedObj,
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


    async function getMachineHoursData(bucketToGet, start, stop, previousDay = false) {
        let _start = start
        let _stop = stop
        const machineHoursQuery = `from(bucket: "${bucketToGet}")
            |> range(start: ${_start}, stop: ${_stop})
            |> filter(fn: (r) => r["_measurement"] == "Gen Info")
            |> filter(fn: (r) => r["_field"] == "Machine Hours")
            |> filter(fn: (r) => not exists r["Alarm One Shot"])`;

        let retArr = [];
        let machineHoursRetObj = await queryClient.collectRows(machineHoursQuery)

        let count = 0;
        while (previousDay && machineHoursRetObj.length === 0 && count < 5) {
            _start = (new Date((Date.parse(_start)) - (86400000))).toISOString();
            _stop = (new Date((Date.parse(_stop)) - (86400000))).toISOString();
            let machineHoursQuery = `from(bucket: "${bucketToGet}")
                |> range(start: ${_start}, stop: ${_stop})
                |> filter(fn: (r) => r["_measurement"] == "Gen Info")
                |> filter(fn: (r) => r["_field"] == "Machine Hours")
                |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
            machineHoursRetObj = await queryClient.collectRows(machineHoursQuery)
            count++
        }



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
    async function getRunTimeData(bucketToGet, start, stop, previousDay = false) {
        let _start = start
        let _stop = stop
        const runTimeQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${_start}, stop: ${_stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Run Time")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
        const retArr = [];
        let runTimeRetObj = await queryClient.collectRows(runTimeQuery)

        let count = 0;
        while (previousDay && runTimeRetObj.length === 0 && count < 5) {
            _start = (new Date((Date.parse(_start)) - (86400000))).toISOString();
            _stop = (new Date((Date.parse(_stop)) - (86400000))).toISOString();
            let runTimeQuery = `from(bucket: "${bucketToGet}")
                |> range(start: ${_start}, stop: ${_stop})
                |> filter(fn: (r) => r["_measurement"] == "Gen Info")
                |> filter(fn: (r) => r["_field"] == "Run Time")
                |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
            runTimeRetObj = await queryClient.collectRows(runTimeQuery)
            count++
        }

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
    async function getCycleTimeData(bucketToGet, start, stop, previousDay = false) {
        let _start = start
        let _stop = stop
        const cycleTimeQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${_start}, stop: ${_stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Cycle Time")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
        const retArr = [];
        let cycleTimeRetObj = await queryClient.collectRows(cycleTimeQuery)

        let count = 0;
        while (previousDay && cycleTimeRetObj.length === 0 && count < 5) {
            _start = (new Date((Date.parse(_start)) - (86400000))).toISOString();
            _stop = (new Date((Date.parse(_stop)) - (86400000))).toISOString();
            let cycleTimeQuery = `from(bucket: "${bucketToGet}")
                |> range(start: ${_start}, stop: ${_stop})
                |> filter(fn: (r) => r["_measurement"] == "Gen Info")
                |> filter(fn: (r) => r["_field"] == "Cycle Time")
                |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
            cycleTimeRetObj = await queryClient.collectRows(cycleTimeQuery)
            count++
        }

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
    async function getPartProductionData(bucketToGet, start, stop, previousDay = false) {
        let _start = start
        let _stop = stop
        const partProductionQuery = `from(bucket: "${bucketToGet}")
      |> range(start: ${_start}, stop: ${_stop})
      |> filter(fn: (r) => r["_measurement"] == "Gen Info")
      |> filter(fn: (r) => r["_field"] == "Parts Counter")
      |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
        const retArr = [];
        let partProductionRetObj = await queryClient.collectRows(partProductionQuery)

        let count = 0;
        if (previousDay && partProductionRetObj.length === 0 && count < 5) {
            _start = (new Date((Date.parse(_start)) - (86400000))).toISOString();
            _stop = (new Date((Date.parse(_stop)) - (86400000))).toISOString();
            let partProductionQuery = `from(bucket: "${bucketToGet}")
                |> range(start: ${_start}, stop: ${_stop})
                |> filter(fn: (r) => r["_measurement"] == "Gen Info")
                |> filter(fn: (r) => r["_field"] == "Parts Counter")
                |> filter(fn: (r) => not exists r["Alarm One Shot"])`;
            partProductionRetObj = await queryClient.collectRows(partProductionQuery)
            count++
        }



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




    function calculateCycleTimeObj(cycleTimesArray, prevCycleTimeArray) {
        // aggregates the cycle times into arrays with each time
        let secondsArray = buildCycleTimeSecondsTotalArray(cycleTimesArray);
        let prevSecondsArray = buildCycleTimeSecondsTotalArray(prevCycleTimeArray);

        // calcuate total via the aggregate arrays
        let totalInSeconds = calculateTotalTimeInSeconds(secondsArray);
        let prevTotalInSeconds = calculateTotalTimeInSeconds(prevSecondsArray);

        // format the total time into a string
        let formattedTotalTime = formatTotalTime(totalInSeconds);
        let formattedPrevTotalTime = formatTotalTime(prevTotalInSeconds);

        // calculate better today boolean
        let betterTodayTotal = totalInSeconds > prevTotalInSeconds;

        // calculate the percentage change between the two totals
        let percentageChange = calculatePercentageChange(totalInSeconds, prevTotalInSeconds);

        // calculate the average cycle times
        let averageCycleTime = calculateAverageCycleTime(totalInSeconds, secondsArray.length);
        let prevAverageCycleTime = calculateAverageCycleTime(prevTotalInSeconds, prevSecondsArray.length);

        // format the average cycle time into a string
        let formattedAverageCycleTime = formatTotalTime(averageCycleTime);
        let formattedPrevAverageCycleTime = formatTotalTime(prevAverageCycleTime);


        let cycleTimeReturnObj = {
            totalCycleTime: formattedTotalTime,
            prevTotalCycleTime: formattedPrevTotalTime,
            betterTodayTotal: betterTodayTotal,
            percentageChange: percentageChange,
            averageCycleTime: formattedAverageCycleTime,
            prevAverageCycleTime: formattedPrevAverageCycleTime

        }

        function buildCycleTimeSecondsTotalArray(arrayToBuild) {
            let retArr = [];
            if (arrayToBuild.length === 0) {
                return 0
            }
            if (arrayToBuild.length === 1) {
                retArr.push(Math.round((Math.floor(arrayToBuild[0]._value) * 60) + ((arrayToBuild[0]._value % 1) * 100)))
                return retArr
            }
            for (let i = 0; i < arrayToBuild.length; i++) {

                if (i === arrayToBuild.length - 1 && retArr.length === 0) {
                    retArr.push(Math.round((Math.floor(arrayToBuild[i]._value) * 60) + ((arrayToBuild[i]._value % 1) * 100)))
                    return retArr
                }


                if (i !== 0 && arrayToBuild[i]._value < arrayToBuild[i - 1]._value) {
                    //turn the cycle time into seconds
                    retArr.push(Math.round((Math.floor(arrayToBuild[i - 1]._value) * 60) + ((arrayToBuild[i - 1]._value % 1) * 100)))
                }
            }

            return retArr
        }
        function calculateTotalTimeInSeconds(arrayToCalc) {
            let retTotal = 0;
            for (let i = 0; i < arrayToCalc.length; i++) {
                retTotal += arrayToCalc[i]
            }
            return retTotal
        }
        function formatTotalTime(totalTimeInSeconds) {
            const hours = Math.floor(totalTimeInSeconds / 60 / 60);
            const minutes = Math.floor(totalTimeInSeconds / 60) - (hours * 60);
            const seconds = Math.floor(totalTimeInSeconds % 60);

            if (hours === 0 && minutes === 0) {
                return seconds + "s";
            } else if (hours === 0) {
                return minutes + "m " + seconds + "s";
            } else {
                return hours + "h " + minutes + "m " + seconds + "s";
            }
        }
        function calculatePercentageChange(totalInSeconds, prevTotalInSeconds) {
            let percentageChange = 0;
            if (prevTotalInSeconds === 0) {
                return "100%"
            }
            if (totalInSeconds === 0) {
                return "-100%"
            }
            percentageChange = ((totalInSeconds - prevTotalInSeconds) / prevTotalInSeconds) * 100;
            return percentageChange.toFixed(2) + "%"
        }
        function calculateAverageCycleTime(total, length) {
            if (total === 0 || length === 0) {
                return 0
            }
            return total / length
        }



        return cycleTimeReturnObj

    }
    function calculateProductivity(runTimesArray, machineHoursArray, prevRunTimesArray, prevMachineHoursArray) {
        let productivity = calculateProductivity(runTimesArray, machineHoursArray);
        let prevProductivity = calculateProductivity(prevRunTimesArray, prevMachineHoursArray);
        let betterToday = productivity > prevProductivity;
        let percentageChange = calculatePercentageChange(productivity, prevProductivity);

        let downtime = calculateDowntime(runTimesArray, machineHoursArray);
        let prevDowntime = calculateDowntime(prevRunTimesArray, prevMachineHoursArray);
        let betterTodayDowntime = downtime < prevDowntime;
        //multiplying by negative one gives the correct % change for downtime as more downtime is bad and less is gooder
        let percentageChangeDowntime = (calculatePercentageChange(downtime, prevDowntime) * -1);

        let retObj = {
            productivity: productivity + "%",
            prevProductivity: prevProductivity + "%",
            betterTodayProductivity: betterToday,
            percentageChangeProductivity: percentageChange + "%",
            downtime: formatTotal(downtime),
            prevDowntime: formatTotal(prevDowntime),
            betterTodayDowntime: betterTodayDowntime,
            percentageChangeDowntime: percentageChangeDowntime + "%"
        }

        function calculateProductivity(runTimeToCalc, machineHoursToCalc) {
            //if there are no run hours or machine hours then there is no productivity
            if (runTimeToCalc.length === 0 || machineHoursToCalc.length === 0) {
                return 0
            }
            if (runTimeToCalc.length === 1 || machineHoursToCalc.length === 1) {
                return 0
            }

            let runTimeTotal = runTimeToCalc[runTimeToCalc.length - 1]._value - runTimeToCalc[0]._value;
            let machineHoursTotal = machineHoursToCalc[machineHoursToCalc.length - 1]._value - machineHoursToCalc[0]._value;

            //if there are no machine hours this would indicate it was flipped on and off twice but for just one minute at a time which would indicate no run time
            //if there are no run hours regardless of machine hours this would indicate there was no productivity for the day
            //I want to alleviate the case of dividing 0 by something or just dividing by 0
            if (machineHoursTotal === 0 || runTimeTotal === 0) {
                return 0
            }
            //as long as both of these values are non zero the division can occur   
            let productivityValue = runTimeTotal / machineHoursTotal;
            return Math.round(((productivityValue.toFixed(2)) * 100));
        }

        function calculateDowntime(runTimeToCalc, machineHoursToCalc) {
            //if there are no run hours or machine hours then there is no dowtime
            if (runTimeToCalc.length === 0 || machineHoursToCalc.length === 0) {
                return 0
            }
            if (runTimeToCalc.length === 1 || machineHoursToCalc.length === 1) {
                return 0
            }
            let runTimeTotal = runTimeToCalc[runTimeToCalc.length - 1]._value - runTimeToCalc[0]._value;
            let machineHoursTotal = machineHoursToCalc[machineHoursToCalc.length - 1]._value - machineHoursToCalc[0]._value;

            //if there are no machine hours this would indicate it was flipped on and off twice but for just one minute at a time which would indicate no run time
            //if there are no run hours regardless of machine hours this would indicate there was no productivity for the day
            //I want to alleviate the case of dividing 0 by something or just dividing by 0
            if (machineHoursTotal === 0 || runTimeTotal === 0) {
                return 0
            }

            let downtimeValue = machineHoursTotal - runTimeTotal;
            return downtimeValue;
        }

        function calculatePercentageChange(total, prevTotal) {
            let percentageChange = 0;
            if (prevTotal === 0) {
                return "100"
            }
            if (total === 0) {
                return "-100"
            }
            percentageChange = ((total - prevTotal) / prevTotal) * 100;
            return percentageChange.toFixed(2)
        }




        return retObj;
    }
    function calculateMachineHoursTotal(machineHoursArray, prevMachineHoursArray) {
        let machineHoursTotal = calculateMachineHoursTotal(machineHoursArray);
        let prevMachineHoursTotal = calculateMachineHoursTotal(prevMachineHoursArray);
        let betterToday = machineHoursTotal > prevMachineHoursTotal;
        let percentageChange = calculatePercentageChange(machineHoursTotal, prevMachineHoursTotal);
        let formattedTotal = formatTotal(machineHoursTotal);
        let formattedPrevTotal = formatTotal(prevMachineHoursTotal);
        let retObj = {
            machineHoursTotal: formattedTotal,
            prevMachineHoursTotal: formattedPrevTotal,
            betterToday: betterToday,
            percentageChange: percentageChange + "%"
        }
        function calculateMachineHoursTotal(arrayToCalc) {

            if (arrayToCalc.length === 0) {
                return 0
            }
            if (arrayToCalc.length === 1) {
                return 0
            }
            let machineHoursTotal = arrayToCalc[arrayToCalc.length - 1]._value - arrayToCalc[0]._value;
            return machineHoursTotal;
        }
        function calculatePercentageChange(total, prevTotal) {
            let percentageChange = 0;
            if (prevTotal === 0) {
                return "100"
            }
            if (total === 0) {
                return "-100"
            }
            percentageChange = ((total - prevTotal) / prevTotal) * 100;
            return percentageChange.toFixed(2)
        }
        function formatTotal(totalToFormat) {
            const hours = Math.floor(totalToFormat / 60);
            const minutes = Math.floor(totalToFormat % 60);
            if (hours === 0) {
                return minutes + "m";
            } else {
                return hours + "h " + minutes + "m";
            }
        }


        return retObj;
    }
    function calculatePartsProduced(partProductionArray, prevPartProductionArray) {
        let partsProducedTotal = calculatePartsProduced(partProductionArray);
        let prevPartsProducedTotal = calculatePartsProduced(prevPartProductionArray);
        let betterToday = partsProducedTotal >= prevPartsProducedTotal;

        let percentageChange = calculatPercentageChagned(partsProducedTotal, prevPartsProducedTotal)


        let retObj = {
            partsProducedTotal: partsProducedTotal,
            betterToday: betterToday,
            percentageChange: percentageChange + "%",
            prevPartsProducedTotal: prevPartsProducedTotal
        }

        function calculatePartsProduced(arrayToCalc) {
            if (arrayToCalc.length === 0) {
                return 0
            }
            if (arrayToCalc.length === 1) {
                return 1
            }
            let partsProducedTotal = arrayToCalc[arrayToCalc.length - 1]._value - arrayToCalc[0]._value;
            return partsProducedTotal;
        }

        function calculatPercentageChagned(total, prevTotal) {
            if (prevTotal === 0 && total != 0) {
                return 100;
            }
            if (prevTotal != 0 && total === 0) {
                return -100;
            }
            if (prevTotal === 0 && total === 0) {
                return 0;
            }
            return (((total - prevTotal) / prevTotal) * 100).toFixed(2);
        }
        return retObj;
    }


    function formatTotal(totalToFormat) {
        const hours = Math.floor(totalToFormat / 60);
        const minutes = Math.floor(totalToFormat % 60);
        if (hours === 0) {
            return minutes + "m";
        } else {
            return hours + "h " + minutes + "m";
        }
    }

})

app.post('/sfm-options/', jsonParser, (req, res) => {
    console.log(req.body)
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const measurment = req.body.measurement;
    const queryClient = createQueryClient(url, userToken, userOrg)

    const getData = async () => {
        const optionsQuery = `from(bucket: "${bucket}")
    |> range(start: 0)
    |> filter(fn: (r) => r["_measurement"] == "${measurment}")
    |> filter(fn: (r) => not exists r["Alarm One Shot"])
    |> last()
    |> keep(columns: ["_field"])`

        try {
            const optionsRetObj = await queryClient.collectRows(optionsQuery)
            res.status(200).send(optionsRetObj)
        }
        catch (err) {
            console.log(err)
        }
    }
    getData()
})

app.post('/sfm-data/', jsonParser, (req, res) => {
    console.log(req.body)
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const measurment = req.body.measurement;
    const field = req.body.field;
    const queryClient = createQueryClient(url, userToken, userOrg)

    const getData = async () => {
        const dataQuery = `from(bucket: "${bucket}")
        |> range(start: 0)
        |> filter(fn: (r) => r["_measurement"] == "${measurment}")
        |> filter(fn: (r) => r["_field"] == "${field}")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> last()`

        try {
            const dataRetObj = await queryClient.collectRows(dataQuery)
            res.status(200).send(dataRetObj)
        }
        catch (err) {
            console.log(err)
        }
    }
    getData()
})

app.post('/sfm-measurements/', jsonParser, (req, res) => {
    console.log(req.body)
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const queryClient = createQueryClient(url, userToken, userOrg)

    const getData = async () => {
        const optionsQuery = `import "influxdata/influxdb/schema"
        schema.measurements(bucket: "${bucket}")`
        try {
            const optionsRetObj = await queryClient.collectRows(optionsQuery)
            res.status(200).send(optionsRetObj)
        }
        catch (err) {
            console.log(err)
        }
    }
    getData()
})

app.post('/sfm-fields/', jsonParser, (req, res) => {
    console.log(req.body)
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const measurment = req.body.measurement;
    const queryClient = createQueryClient(url, userToken, userOrg)

    const getData = async () => {
        const optionsQuery = `import "influxdata/influxdb/schema"
        schema.fieldKeys(bucket: "${bucket}", predicate: (r) => r._measurement == "${measurment}")`
        try {
            const optionsRetObj = await queryClient.collectRows(optionsQuery)
            console.log(optionsRetObj)
            res.status(200).send(optionsRetObj)
        }
        catch (err) {
            console.log(err)
        }
    }
    getData()
})

app.post('/count', jsonParser, (req, res) => {
    console.log(req.body)
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const measurment = req.body.measurement;
    const queryClient = createQueryClient(url, userToken, userOrg)

    const getData = async () => {
        const optionsQuery = `from(bucket: "${bucket}")
            |> range(start: -30d)
            |> count()`
        try {
            const optionsRetObj = await queryClient.collectRows(optionsQuery)
            let retCount = 0;
            if (optionsRetObj.length > 0) {
                console.log(optionsRetObj.length)
                for (let i = 0; i < optionsRetObj.length; i++) {
                    const element = optionsRetObj[i];
                    retCount += element._value
                }
            }

            res.status(200).send({ "Count": retCount })
        }
        catch (err) {
            console.log(err)
        }
    }
    getData()
})

app.post('/program-history', jsonParser, (req, res) => {
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const day = (new Date(req.body.day)).toISOString().split('T')[0].toString();

    if (userToken == undefined || userOrg == undefined || bucket == undefined || day == undefined) {
        console.log("Missing Parameters")
        res.status(400).send("Missing Parameters")
        return
    }

    const queryClient = createQueryClient(url, userToken, userOrg)
    const getData = async () => {
        let programObjects = [];
        let allCycleTimes = await getCycleTimes()
        let programNames = await getProgramNames()
        let partsProduced = await getPartProductionData()

        if (allCycleTimes.length !== 0) {
            for (let i = 0; i < allCycleTimes.length; i++) {
                if (i != 0 && allCycleTimes[i]._value < allCycleTimes[i - 1]._value) {
                    //this means we found a completed cycle
                    let cycleEndTime = allCycleTimes[i - 1]._time
                    let cycleLength = allCycleTimes[i - 1]._value
                    let cycleStartTime;
                    for (let j = i - 1; j >= 0; j--) {
                        if (j == 1 || j == 0) {
                            cycleStartTime = allCycleTimes[0]._time
                            break;
                        }
                        if (allCycleTimes[j - 1]._value > allCycleTimes[j]._value) {
                            cycleStartTime = allCycleTimes[j]._time
                            break;
                        }
                    }
                    if (cycleStartTime == undefined) {
                        cycleStartTime = "No Data"
                    }
                    programObjects.push(
                        {
                            cycleStartTime: cycleStartTime, //used for display
                            cycleStartUTC: cycleStartTime, //used for DB queries later

                            cycleEndTime: cycleEndTime, //used for display
                            cycleEndUTC: cycleEndTime,  //used for DB queries later

                            cycleLength: cycleLength,
                            loadTime: 0,
                            programName: "",
                            didFinish: false,
                            id: i
                        })
                }
            }
            console.log("Program Objects Initialized")
            console.log("Adding Load Time")

            for (let i = 0; i < programObjects.length; i++) {
                if (i == 0) {
                    programObjects[i].loadTime = 0 //first program has no load time
                }
                else {
                    let prevEnd = new Date(programObjects[i - 1].cycleEndTime).getTime();
                    let currentStart = new Date(programObjects[i].cycleStartTime).getTime();
                    let difference = currentStart - prevEnd;
                    let differenceInSeconds = Math.round(difference / 1000); // Convert to seconds
                    let differenceInMinutes = Math.floor(differenceInSeconds / 60);
                    let remainingSeconds = differenceInSeconds % 60;

                    programObjects[i].loadTime = `${differenceInMinutes}m ${remainingSeconds}s`;
                }
            }
        }

        else {
            res.status(200).send([{ cycleStartTime: "No Data", cycleEndTime: "No Data", cycleLength: "No Data", loadTime: "No Data", programName: "No Data", didFinish: "No Data" }])
            return
        }
        //at this point we have cycle start times and end times and load times
        //add program names
        console.log("Adding Program Names")
        if (programNames.length > 0) {
            for (let i = 0; i < programObjects.length; i++) {

                let cycleStartTime = new Date(programObjects[i].cycleStartTime).getTime()
                let cycleEndTime = new Date(programObjects[i].cycleEndTime).getTime()

                for (let j = 0; j < programNames.length; j++) {
                    let programTime = new Date(programNames[j]._time).getTime()
                    if (programTime > cycleStartTime && programTime < cycleEndTime) {
                        programObjects[i].programName = programNames[j]._value
                        break;
                    }
                }
            }
        }
        else {
            return
        }
        //at this point names are added and we just need to check to see if it finished
        console.log("Adding Finished Status")
        if (partsProduced.length > 0) {
            for (let i = 0; i < programObjects.length; i++) {
                let cycleEndTime = new Date(programObjects[i].cycleEndTime).getTime()
                for (let j = 0; j < partsProduced.length; j++) {
                    let partTime = new Date(partsProduced[j]._time).getTime()
                    if (partTime > cycleEndTime - 2000 && partTime < cycleEndTime + 2000) {
                        programObjects[i].didFinish = true
                        break;
                    }
                }
            }
        }

        //update Times to local
        console.log("Updating Times to Local and formatting Duration")
        programObjects.forEach((program) => {
            program.cycleStartTime = new Date(program.cycleStartTime).toLocaleTimeString().split(" ")[0]
            program.cycleEndTime = new Date(program.cycleEndTime).toLocaleTimeString().split(" ")[0]
            let cycleLength = program.cycleLength.toString().split(".")
            program.cycleLength = `${cycleLength[0]}m ${(cycleLength[1])}s`
        })

        let trueCount = 0;
        let partsProducedCount = partsProduced.length - 1;
        programObjects.forEach((program) => {
            if (program.didFinish) {
                trueCount++
            }
        })
        console.log("Programs Written As True: " + trueCount)
        console.log("Parts Produced Count: " + partsProducedCount)


        res.status(200).send(programObjects)
    }

    const getCycleTimes = async () => {
        console.log("Getting Cycle Times")
        const cycleTimeQuery = `from(bucket: "${bucket}")
        |> range(start: ${day}, stop: ${day + "T23:59:59Z"})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Cycle Time")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])`
        try {
            const cycleTimeObj = await queryClient.collectRows(cycleTimeQuery)
            return cycleTimeObj
        }
        catch (err) {
            console.log(err)
        }
    }
    const getProgramNames = async () => {
        console.log("Getting Program Names")
        const programNameQuery = `from(bucket: "${bucket}")
        |> range(start: ${day}, stop: ${day + "T23:59:59Z"})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Program Name")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])`

        try {
            const programNameObj = await queryClient.collectRows(programNameQuery)
            return programNameObj
        }
        catch (err) {
            console.log(err)
        }
    }
    const getPartProductionData = async () => {
        console.log("Getting Part Production Data")
        const partProductionQuery = `from(bucket: "${bucket}")
        |> range(start: ${day}, stop: ${day + "T23:59:59Z"})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Parts Counter")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])`

        try {
            const partProductionObj = await queryClient.collectRows(partProductionQuery)
            return partProductionObj
        }
        catch (err) {
            console.log(err)
        }
    }

    getData()


})

app.post('/program-history-details', jsonParser, (req, res) => {
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const start = req.body.start;
    const stop = req.body.stop;

    console.log(req.body)
    let responseObj = {
        rapidOverrideSlowedDown: "No Data",
        feedrateOverrideSlowedDown: "No Data",
        spindleOverrideSlowedDown: "No Data",

        //It would be important to know if these overrides were over 100
        rapidOverrideSpedUp: "No Data",
        feedrateOverrideSpedUp: "No Data",
        spindleOverrideSpedUp: "No Data",

        //override numbers
        rapidOverrideMax: "No Data",
        rapidOverrideMin: "No Data",

        feedrateOverrideMax: "No Data",
        feedrateOverrideMin: "No Data",

        spindleOverrideMax: "No Data",
        spindleOverrideMin: "No Data",
    }

    if (userToken == undefined || userOrg == undefined || start == undefined || stop == undefined) {
        console.log("Missing Parameters")
        res.status(400).send("Missing Parameters")
        return
    }

    const queryClient = createQueryClient(url, userToken, userOrg)
    const getData = async () => {
        let overrideQueryInfo = await getOverrideInfo()
        let spindleQueryInfo = await getSpindleInfo()
        processOverrideInfo(overrideQueryInfo)
        let retunObj = { ...responseObj, ...spindleQueryInfo }
        res.status(200).send(retunObj)
    }
    getData();

    async function getOverrideInfo() {
        const overrideQuery = `from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Feed Rate Override" or r["_field"] == "Rapid Override" or r["_field"] == "Spindle Override")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> distinct()`
        try {
            const overrideQueryReturn = await queryClient.collectRows(overrideQuery)
            return overrideQueryReturn
        }
        catch (err) {
            console.log(err)
        }
    }
    async function getSpindleInfo() {
        let spindleInfoToReturn = { spike: "No Data", average: "No Data" };

        const spindleMaxSpikeQuery = `from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Spindle: S1 Load")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> max()`
        const spindleAverageQuery = `from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Spindle: S1 Load")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> filter(fn: (r) => r._value != 0)
        |> mean()`
        try {
            const spindleMaxSpikeInfo = await queryClient.collectRows(spindleMaxSpikeQuery)
            const spindleAverageInfo = await queryClient.collectRows(spindleAverageQuery)
            if (spindleMaxSpikeInfo.length > 0) {
                spindleInfoToReturn.spike = spindleMaxSpikeInfo[0]._value
            }
            if (spindleAverageInfo.length > 0) {
                spindleInfoToReturn.average = spindleAverageInfo[0]._value.toFixed(2)
            }
            return spindleInfoToReturn
        }
        catch (err) {
            console.log(err)
            return spindleInfoToReturn
        }
    }
    function processOverrideInfo(overrideData) {
        let rapidOverrideArray = [];
        let feedrateOverrideArray = [];
        let spindleOverrideArray = [];
        for (let i = 0; i < overrideData.length; i++) {
            if (overrideData[i]._field === "Rapid Override") {
                rapidOverrideArray.push(overrideData[i]._value)
            }
            if (overrideData[i]._field === "Feed Rate Override") {
                feedrateOverrideArray.push(overrideData[i]._value)
            }
            if (overrideData[i]._field === "Spindle Override") {
                spindleOverrideArray.push(overrideData[i]._value)
            }
        }
        //empty arrays evalute to Math.max == -Infinity and Math.min == Infinity
        responseObj.rapidOverrideMax = Math.max(...rapidOverrideArray) == -Infinity ? "No Data" : Math.max(...rapidOverrideArray)
        responseObj.rapidOverrideMin = Math.min(...rapidOverrideArray) == Infinity ? "No Data" : Math.min(...rapidOverrideArray)

        if (responseObj.rapidOverrideMax > 100) {
            responseObj.rapidOverrideSpedUp = true
        }
        else {
            responseObj.rapidOverrideSpedUp = false
        }

        if (responseObj.rapidOverrideMin < 100) {
            responseObj.rapidOverrideSlowedDown = true
        }
        else {
            responseObj.rapidOverrideSlowedDown = false
        }

        responseObj.feedrateOverrideMax = Math.max(...feedrateOverrideArray) == -Infinity ? "No Data" : Math.max(...feedrateOverrideArray)
        responseObj.feedrateOverrideMin = Math.min(...feedrateOverrideArray) == Infinity ? "No Data" : Math.min(...feedrateOverrideArray)

        if (responseObj.feedrateOverrideMax > 100) {
            responseObj.feedrateOverrideSpedUp = true
        }
        else {
            responseObj.feedrateOverrideSpedUp = false
        }

        if (responseObj.feedrateOverrideMin < 100) {
            responseObj.feedrateOverrideSlowedDown = true
        }
        else {
            responseObj.feedrateOverrideSlowedDown = false
        }


        responseObj.spindleOverrideMax = Math.max(...spindleOverrideArray) == -Infinity ? "No Data" : Math.max(...spindleOverrideArray)
        responseObj.spindleOverrideMin = Math.min(...spindleOverrideArray) == Infinity ? "No Data" : Math.min(...spindleOverrideArray)

        if (responseObj.spindleOverrideMax > 100) {
            responseObj.spindleOverrideSpedUp = true
        }
        else {
            responseObj.spindleOverrideSpedUp = false
        }

        if (responseObj.spindleOverrideMin < 100) {
            responseObj.spindleOverrideSlowedDown = true
        }
        else {
            responseObj.spindleOverrideSlowedDown = false
        }

    }

})

app.get('/yesterdayAtAGlance', jsonParser, function (req, res) {
    const yesterday = (new Date(Date.now() - 86400000).toISOString().split('T')[0]).toString();
    const today = (new Date().toISOString().split('T')[0]).toString();
    const buckets = req.body.buckets;
    const org = req.headers.org;
    const token = req.headers.token;
    const queryClient = createQueryClient(url, token, org)

    const getData = async () => {
        let yesterdayAtAGlance = [];
        for (const bucket in buckets) {
            let bucketToGet = buckets[bucket];
            let programNameObj = await getFirstAndLastProgram(bucketToGet, yesterday, today)
            let cycleStatEndTimeObj = await getFirstCycleTimeandLastCycleTime(bucketToGet, yesterday, today)
            let runTimeRet = await getTotalRunTime(bucketToGet, yesterday, today)
            let machineOnTimeRet = await getMachineOnTime(bucketToGet, yesterday, today)
            let partsProducedRet = await getPartProductionData(bucketToGet, yesterday, today)
            let productivityRet = calculateProductivity(runTimeRet, machineOnTimeRet)
            let retObject = {
                ...programNameObj,
                ...cycleStatEndTimeObj,
                bucket: bucketToGet,
                RunTime: runTimeRet,
                MachineOnTime: machineOnTimeRet,
                PartsProduced: partsProducedRet,
                Productivity: productivityRet
            }
            yesterdayAtAGlance.push(retObject)
        }

        res.status(200).send(yesterdayAtAGlance)
    }

    async function getFirstAndLastProgram(bucketToGet, yesterday, today) {
        const firstProgramQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Program Name")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> first()`
        const lastProgramQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Program Name")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> last()`
        try {
            const firstProgram = await queryClient.collectRows(firstProgramQuery)
            const lastProgram = await queryClient.collectRows(lastProgramQuery)
            return {
                firstProgram: firstProgram[0]._value ? firstProgram[0]._value : "No Data",
                lastProgram: lastProgram[0]._value ? lastProgram[0]._value : "No Data",
            }
        }
        catch (err) {
            console.log(err)
            return "No Data"
        }
    }

    async function getFirstCycleTimeandLastCycleTime(bucketToGet, yesterday, today) {
        const firstCycleTimeQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Cycle Time")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> first()`
        const lastCycleTimeQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Cycle Time")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> last()`
        try {
            const firstCycleTime = await queryClient.collectRows(firstCycleTimeQuery)
            const lastCycleTime = await queryClient.collectRows(lastCycleTimeQuery)
            return {
                firstCycleTime: firstCycleTime[0]._time ? firstCycleTime[0]._time : "No Data",
                lastCycleTime: lastCycleTime[0]._time ? lastCycleTime[0]._time : "No Data",
            }

        }
        catch (err) {
            console.log(err)
            return "No Data"
        }
    }

    async function getTotalRunTime(bucketToGet, yesterday, today) {
        const getRunTimeQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Run Time")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> spread()`

        try {
            const runTime = await queryClient.collectRows(getRunTimeQuery)
            if (runTime.length > 0) {
                return runTime[0]._value
            }
            else {
                return "No Data"
            }
        }
        catch (err) {
            console.log(err)
            return "No Data"
        }
    }

    async function getMachineOnTime(bucketToGet, yesterday, today) {
        const getRunTimeQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Machine Hours")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> spread()`

        try {
            const machineOnTime = await queryClient.collectRows(getRunTimeQuery)
            if (machineOnTime.length > 0) {
                return machineOnTime[0]._value
            }
            else {
                return "No Data"
            }
        }
        catch (err) {
            console.log(err)
            return "No Data"
        }
    }

    async function getPartProductionData(bucketToGet, yesterday, today) {
        const partProductionQuery = `from(bucket: "${bucketToGet}")
        |> range(start: ${yesterday}, stop: ${today})
        |> filter(fn: (r) => r["_measurement"] == "Gen Info")
        |> filter(fn: (r) => r["_field"] == "Parts Counter")
        |> filter(fn: (r) => not exists r["Alarm One Shot"])
        |> spread()`

        try {
            const partProduction = await queryClient.collectRows(partProductionQuery)
            if (partProduction.length > 0) {
                return partProduction[0]._value
            }
            else {
                return "No Data"
            }
        }
        catch (err) {
            console.log(err)
            return "No Data"
        }
    }

    function calculateProductivity(runTime, onTime) {
        if (runTime == undefined || onTime == undefined) {
            return "No Data"
        }
        if (runTime == "No Data" || onTime == "No Data") {
            return "No Data"
        }
        let productivity = (runTime / onTime) * 100
        return productivity.toFixed(2) + "%"

    }

    getData();
})

app.get('/todaysStats', jsonParser, function (req, res) {
    const tomorrow = (new Date(Date.now() + 86400000).toISOString().split('T')[0]).toString();
    const today = (new Date().toISOString().split('T')[0]).toString();
    const buckets = req.body.buckets;
    const org = req.headers.org;
    const token = req.headers.token;
    const queryClient = createQueryClient(url, token, org)

    const getData = async () => {
        //see what machines have actually writted dater
        let didMachinesWriteObj = await getDidMachinesWriteData(buckets)
        //get parts produced for all them mocheens
        let partsProducedTotal = await getAllThePartsProduced(didMachinesWriteObj)
        //get run time for all them mocheens
        let runTimeTotal = await getAllTheRunTime(didMachinesWriteObj)
        //get machine on time for all them mocheens
        let machineOnTimeTotal = await getAllTheMachineOnTime(didMachinesWriteObj)
        //set producitivity for all them mocheens
        let productivityTotal = await setAlltheProductivity(runTimeTotal,machineOnTimeTotal)
        //set total reporting machines count
        let totalReportingMachines =  getReportingMachinesCount(didMachinesWriteObj)
        //format return object
        let returnObject = formatReturnObject(partsProducedTotal, runTimeTotal, machineOnTimeTotal, productivityTotal, totalReportingMachines)
        res.status(200).send(returnObject)

    }


    getData();

    async function getDidMachinesWriteData(bucketsToCheck) {
        let toRet = [];
        for (const bumkit in bucketsToCheck) {
            let bucketToCheck = bucketsToCheck[bumkit]
            const getDidMachinesWriteQuery = `from(bucket: "${bucketToCheck}")
            |> range(start: ${today}, stop: ${tomorrow})
            |> filter(fn: (r) => r["_measurement"] == "Gen Info")
            |> count()`
            try {
                const didMachinesWrite = await queryClient.collectRows(getDidMachinesWriteQuery)
                if (didMachinesWrite.length > 0) {
                    toRet.push({ SN: bucketsToCheck[bumkit], WroteToday: true })
                }
                else {
                    toRet.push({ SN: bucketsToCheck[bumkit], WroteToday: false })
                }
            }
            catch (err) {
                console.log(err)
                toRet.push({ SN: bucketsToCheck[bumkit], WroteToday: false })
            }
        }
        return toRet
    }
    async function getAllThePartsProduced(bucketsToCheck) {
        let individualPartsProducedArr = [];
        let totalPartsProduced;
        for (const bumkit in bucketsToCheck) {
            if (!bucketsToCheck[bumkit].WroteToday) {
                return
            }
            let bucketToCheck = bucketsToCheck[bumkit]

            const getPartsProducedQuery = `from(bucket: "${bucketToCheck.SN}")
            |> range(start: ${today})
            |> filter(fn: (r) => r["_measurement"] == "Gen Info")
            |> filter(fn: (r) => r["_field"] == "Parts Counter")
            |> filter(fn: (r) => not exists r["Alarm One Shot"])
            |> spread()`

            try {
                const partsProduced = await queryClient.collectRows(getPartsProducedQuery)
                if (partsProduced.length > 0) {
                    individualPartsProducedArr.push(partsProduced[0]._value)
                }
                else {
                    individualPartsProducedArr.push(partsProduced.push(0))
                }
            }
            catch (err) {
                console.log(err)
                individualPartsProducedArr.push(partsProduced.push(0))
            }
        }

        if (individualPartsProducedArr.length > 0) {
            totalPartsProduced = individualPartsProducedArr.reduce((a, b) => a + b, 0)
        }

        return totalPartsProduced
    }
    async function getAllTheRunTime(bucketsToCheck) {
        let individualRunTimeArr = [];
        let totalRunTime;
        for (const bumkit in bucketsToCheck) {
            if (!bucketsToCheck[bumkit].WroteToday) {
                return
            }
            let bucketToCheck = bucketsToCheck[bumkit]

            const getRunTimeQuery = `from(bucket: "${bucketToCheck.SN}")
            |> range(start: ${today})
            |> filter(fn: (r) => r["_measurement"] == "Gen Info")
            |> filter(fn: (r) => r["_field"] == "Run Time")
            |> filter(fn: (r) => not exists r["Alarm One Shot"])
            |> spread()`

            try {
                const runTime = await queryClient.collectRows(getRunTimeQuery)
                if (runTime.length > 0) {
                    individualRunTimeArr.push(runTime[0]._value)
                }
                else {
                    individualRunTimeArr.push(runTime.push(0))
                }
            }
            catch (err) {
                console.log(err)
                individualRunTimeArr.push(runTime.push(0))
            }
        }

        if (individualRunTimeArr.length > 0) {
            totalRunTime = individualRunTimeArr.reduce((a, b) => a + b, 0)
        }

        return totalRunTime
    }
    async function getAllTheMachineOnTime(bucketsToCheck){
        let individualMachineOnTimeArr = [];
        let totalMachineOnTime;
        for (const bumkit in bucketsToCheck) {
            if (!bucketsToCheck[bumkit].WroteToday) {
                return
            }
            let bucketToCheck = bucketsToCheck[bumkit]

            const getMachineOnTimeQuery = `from(bucket: "${bucketToCheck.SN}")
            |> range(start: ${today})
            |> filter(fn: (r) => r["_measurement"] == "Gen Info")
            |> filter(fn: (r) => r["_field"] == "Machine Hours")
            |> filter(fn: (r) => not exists r["Alarm One Shot"])
            |> spread()`

            try {
                const machineOnTime = await queryClient.collectRows(getMachineOnTimeQuery)
                if (machineOnTime.length > 0) {
                    individualMachineOnTimeArr.push(machineOnTime[0]._value)
                }
                else {
                    individualMachineOnTimeArr.push(machineOnTime.push(0))
                }
            }
            catch (err) {
                console.log(err)
                individualMachineOnTimeArr.push(machineOnTime.push(0))
            }
        }

        if (individualMachineOnTimeArr.length > 0) {
            totalMachineOnTime = individualMachineOnTimeArr.reduce((a, b) => a + b, 0)
        }

        return totalMachineOnTime
    }
    function setAlltheProductivity(runTimeTotal,machineOnTimeTotal){
        if(runTimeTotal == undefined || machineOnTimeTotal == undefined){
            return "No Data"
        }
        if(runTimeTotal == "No Data" || machineOnTimeTotal == "No Data"){
            return "No Data"
        }
        let productivity = (runTimeTotal / machineOnTimeTotal) * 100
        return productivity.toFixed(2) + "%"
    }
    function getReportingMachinesCount(machinesToCheck){
        let count = 0;
        machinesToCheck.forEach((machine)=>{
            if(machine.WroteToday){
                count++
            }
        })
        return count
    }
    function formatReturnObject(partsProducedTotal, runTimeTotal, machineOnTimeTotal, productivityTotal, totalReportingMachines){
        let returnObj = {
            partsProduced: partsProducedTotal,
            runTime: runTimeTotal,
            machineOnTime: machineOnTimeTotal,
            productivity: productivityTotal,
            totalReportingMachines: totalReportingMachines
        }
        return returnObj
    }


})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})



