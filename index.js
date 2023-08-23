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
    function createProgramReturn(pName,pStart,pEnd,pLoad,pFinish){
        let retObj = {
            programName: pName,
            programStart: pStart,
            programEnd: pEnd,
            programLoad: pLoad,
            programFinish: pFinish
        }
        return retObj
    }    
    console.log(req.body)
    const userToken = req.body.token;
    const userOrg = req.body.org;
    const bucket = req.body.bucket;
    const range = req.body.range;
    const queryClient = createQueryClient(url, userToken, userOrg)
    const getData = async () => {
        await getStartandPName()
    }
    const getStartandPName = async () => {
        const optionsQuery = `import "experimental"

        programNames = from(bucket: "145G-Prod")
          |> range(start: -12h)
          |> filter(fn: (r) => r["_measurement"] == "Gen Info")
          |> filter(fn: (r) => r["_field"] == "Program Name")
          |> map(fn: (r) => ({_time: r._time, programName: r._value}))
        
        cycleTimes = from(bucket: "145G-Prod")
          |> range(start: -12h)
          |> filter(fn: (r) => r["_measurement"] == "Gen Info")
          |> filter(fn: (r) => r["_field"] == "Cycle Time")
          |> filter(fn: (r) => r["_value"] == 0.01)
          |> map(fn: (r) => ({_time: r._time, cycleTime: r._value}))
        
        joinedData = join(
          tables: {programNames: programNames, cycleTimes: cycleTimes},
          on: ["_time"]
        ) joinedData`
        try {
            const cycleTimeandProgramName = await queryClient.collectRows(optionsQuery)
            console.log(cycleTimeandProgramName)
            console.log(cycleTimeandProgramName.length)
            res.status(200).send({ "Return": cycleTimeandProgramName })
        }
        catch (err) {
            console.log(err)
        }
    }
    getData()

})


app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})



