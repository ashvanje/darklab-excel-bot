const express = require('express');
const multer = require('multer');
const xlsx = require('node-xlsx');
const axios = require('axios');
const fs = require('fs');
const ExcelJS = require('exceljs');
const WebSocket = require('ws');

const app = express();
require('dotenv').config(); // Load the environment variables from .env file

const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server started on port ${process.env.PORT || 3000} `);
  });
  
  console.log(`server = ${JSON.stringify(server)} `);

  const wss = new WebSocket.Server({ server });
  console.log(`wss = ${JSON.stringify(wss)} `);


  wss.on('connection', (ws) => {
    console.log('WebSocket connection established');
  
    // Send initial progress
    ws.send(JSON.stringify({ progress: 0 }));
  });
  
  
app.get('/websocket-url', (req, res) => {
    const websocketUrl = `ws://${req.headers.host}`;
    console.log(`websocketUrl = ${websocketUrl} `);
    res.json({ websocketUrl });
  });
  

const upload = multer({ dest: 'uploads/' });


app.post('/api/process', upload.single('file'), async (req, res) => {
    console.log(`/api/process`);
    // let progressElement = document.getElementById('progress');
    console.log(`/api/process 2`);
    let file = req.file;
    let template = req.body.template;

    let obj = xlsx.parse(file.path);
    let data = obj[0].data;

    // Assume first row is the header
    let headers = data[0];

    let str = template;

    let regex = /{{(.*?)}}/g;
    let matches = str.match(regex);

    if (matches) {
        matches = matches.map(function(match) {
            // Remove the curly braces from each match
            return match.slice(2, -2).trim();
        });
    }
    console.log(`matches: ${JSON.stringify(matches)}`)

    // Find index of 'Gap' and 'Recommendation' columns
    console.log(`headers.indexOf(control) = ${headers.indexOf("evidence")}`)
    let indices = [];
    for (let match of matches) {
        console.log(`match: ${match}`)
        if (headers.indexOf(match) >= 0) {
            indices.push({
                "field": match,
                "id": headers.indexOf(match)
            });
            console.log(`pushed: ${match} ${JSON.stringify(indices)}`)
        }
    }
    console.log(`indices: ${JSON.stringify(indices)}`);
    // let gapIndex = headers.indexOf('control');
    // let recIndex = headers.indexOf('evidence');
    // let xIndex = headers.indexOf('xx');
    // console.log(`xIndex = ${xIndex}`);

    let matrix = [];
    // Loop from second row (exclude header)

    let newHeader = [];

    let processedItems = 0;
    let totalItems = data.length;

    res.sendStatus(200);

    for (let i = 1; i < data.length; i++) {

        let row = data[i];
        // let control = row[0];
        // let evidence = row[1];
        processedItems++;
        const progress = Math.round((processedItems / totalItems) * 100);
    
        // Send progress update to connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ progress }));
          }
        });

        let prompt = template;
        for (let index of indices ) {
            console.log(`index: ${JSON.stringify(index)}`)
            console.log(`row[index.id]: ${JSON.stringify(row[index.id])}`)
            prompt = prompt.replace(`{{${index.field}}}`, row[index.id]);
        }

        console.log(`prompt: ${prompt}`)
            
        let response = await axios.post('https://api.openai.com/v1/chat/completions', {
            "messages": [{"role": "user", "content": prompt}],
            "model": "gpt-3.5-turbo",
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        let aiResponse = response.data; // Assuming this is the response format
        console.log(`aiResponse: ${JSON.stringify(aiResponse)}`)
        // Add AI response to corresponding columns in row

        let newrow = []
        // newrow.push("HELLO")
        // console.log(`gapIndex: ${gapIndex}`)
        // console.log(`recIndex: ${recIndex}`)

        newrow[0] = row[0]
        newrow[1] = row[1]

        let resultJson = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r",""));

        let x = 0;
        for (let field in resultJson) {
            let value = resultJson[field];
            console.log(`${field}: ${value}`);
            newrow[headers.length + x] = value;
            x = x+1;
        }

        // newrow[headers.length + 0] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).gap;
        // newrow[headers.length + 1] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).recommendation;
        // newrow[headers.length + 2] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).compliance;
        // newrow[headers.length + 3] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).evidence;
        // newrow[gapIndex] = row[gapIndex];
        // newrow[recIndex] = row[recIndex];
        if (newHeader.length == 0) {
            for (let header of headers) {
                newHeader.push(header);
            }
            for (let field in resultJson) {
                newHeader.push(field);
            }
            matrix.push(newHeader);
        }
        matrix.push(newrow)
        
        console.log(`aiResponse end`)
    }

    console.log(`matrix: ${JSON.stringify(matrix)}`)

    let workbook = new ExcelJS.Workbook();
    let worksheet = workbook.addWorksheet('Sheet 1');
    // Set column properties
    // worksheet.columns = [
    //     { header: 'Header1', key: 'header1', width: 10 },
    //     { header: 'Header2', key: 'header2', width: 20 },
    //     { header: 'Header3', key: 'header3', width: 30 },
    // ];


    let columnsDef = []
    // worksheet.columns = []

    console.log(`matrix[0]: ${JSON.stringify(matrix[0])}`)
    for (let header of matrix[0]){
        console.log(`header in columns push: ${header}`)
        columnsDef.push(
            {
                header: header,
                key: `key-${header}`,
                width: 25
            }
        )
    }
    console.log(`worksheet.columns = ${JSON.stringify(columnsDef)}`)
    console.log(`worksheet.columns = [{"header":"control","key":"key-control","width":25},{"header":"evidence","key":"key-evidence","width":25},{"header":"compliance","key":"key-compliance","width":25},{"header":"gap","key":"key-gap","width":25},{"header":"recommendations","key":"key-recommendations","width":25},{"header":"maturity","key":"key-maturity","width":25}]    `)
    // worksheet.columns = [{"header":"control","key":"key-control","width":25},{"header":"evidence","key":"key-evidence","width":25},{"header":"compliance","key":"key-compliance","width":25},{"header":"gap","key":"key-gap","width":25},{"header":"recommendations","key":"key-recommendations","width":25},{"header":"maturity","key":"key-maturity","width":25}]
    worksheet.columns = columnsDef;

    for (let i = 1; i < matrix.length; i++) {
        console.log(`i: ${i}`)
        const result = {};
        for (let j = 0; j < matrix[0].length; j++) {
            result[`key-${matrix[0][j]}`] = matrix[i][j]
        }
        // for (let header of matrix[0]) {
        //     console.log(`header: ${header}`)
        //     for (let matrixElement of matrix[i]) {
        //         console.log(`matrixElement: ${matrixElement}`)
        //         result[`key-${header}`] = matrixElement;
        //         console.log(`end0`)
        //     }
        //     console.log(`end1`)

        // }
        console.log(`end2`)
        let row = worksheet.addRow(result);

        for (let j = 0; j < matrix[0].length; j++) {
            // result[`key-${matrix[0][j]}`] = matrix[i][j]
            row.getCell(`key-${matrix[0][j]}`).alignment = { wrapText: true };
        }
        


    }

    // let row = worksheet.addRow({header1: 'value1', header2: 'value2', header3: 'long value that needs to be wrapped'});

    // Set wrap text alignment in a specific cell
    // row.getCell(3).alignment = { wrapText: true };

    worksheet.columns = columnsDef;
    //todo - calculate column average length, then set the width

    await workbook.xlsx.writeFile(`${process.env.XLSX_OUTPUT_PATH || result.xlsx}`)
        .then(() => {
            console.log('Excel file created successfully.')
            // wss.client.send(JSON.stringify({ progress: 100 }));

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ progress:100 }));
                }
              });
        })
        .catch((error) => console.error(error));

    // let buffer = xlsx.build([{name: "MySheet2", data: matrix}]); 
    // fs.writeFileSync('Result.xlsx', buffer, 'binary'); 

    // res.download('result.xlsx');

    // res.sendStatus(200);
});

// app.post('/api/process', upload.single('file'), async (req, res) => {
//     console.log(`/api/process`);
//     // let progressElement = document.getElementById('progress');
//     console.log(`/api/process 2`);
//     let file = req.file;
//     let template = req.body.template;

//     let obj = xlsx.parse(file.path);
//     let data = obj[0].data;

//     // Assume first row is the header
//     let headers = data[0];

//     let str = template;

//     let regex = /{{(.*?)}}/g;
//     let matches = str.match(regex);

//     if (matches) {
//         matches = matches.map(function(match) {
//             // Remove the curly braces from each match
//             return match.slice(2, -2).trim();
//         });
//     }
//     console.log(`matches: ${JSON.stringify(matches)}`)

//     // Find index of 'Gap' and 'Recommendation' columns
//     console.log(`headers.indexOf(control) = ${headers.indexOf("evidence")}`)
//     let indices = [];
//     for (let match of matches) {
//         console.log(`match: ${match}`)
//         if (headers.indexOf(match) >= 0) {
//             indices.push({
//                 "field": match,
//                 "id": headers.indexOf(match)
//             });
//             console.log(`pushed: ${match} ${JSON.stringify(indices)}`)
//         }
//     }
//     console.log(`indices: ${JSON.stringify(indices)}`);
//     // let gapIndex = headers.indexOf('control');
//     // let recIndex = headers.indexOf('evidence');
//     // let xIndex = headers.indexOf('xx');
//     // console.log(`xIndex = ${xIndex}`);

//     let matrix = [];
//     // Loop from second row (exclude header)

//     let newHeader = [];

//     let processedItems = 0;
//     let totalItems = data.length;
//     for (let i = 1; i < data.length; i++) {

//         let row = data[i];
//         // let control = row[0];
//         // let evidence = row[1];
//         processedItems++;
//         const progress = Math.round((processedItems / totalItems) * 100);
    
//         // Send progress update to connected clients
//         wss.clients.forEach((client) => {
//           if (client.readyState === WebSocket.OPEN) {
//             client.send(JSON.stringify({ progress }));
//           }
//         });

//         let prompt = template;
//         for (let index of indices ) {
//             console.log(`index: ${JSON.stringify(index)}`)
//             console.log(`row[index.id]: ${JSON.stringify(row[index.id])}`)
//             prompt = prompt.replace(`{{${index.field}}}`, row[index.id]);
//         }

//         console.log(`prompt: ${prompt}`)
            
//         let response = await axios.post('https://api.openai.com/v1/chat/completions', {
//             "messages": [{"role": "user", "content": prompt}],
//             "model": "gpt-3.5-turbo",
//             max_tokens: 2000
//         }, {
//             headers: {
//                 'Authorization': 'Bearer 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',
//                 'Content-Type': 'application/json'
//             }
//         });
        
//         let aiResponse = response.data; // Assuming this is the response format
//         console.log(`aiResponse: ${JSON.stringify(aiResponse)}`)
//         // Add AI response to corresponding columns in row

//         let newrow = []
//         // newrow.push("HELLO")
//         // console.log(`gapIndex: ${gapIndex}`)
//         // console.log(`recIndex: ${recIndex}`)

//         newrow[0] = row[0]
//         newrow[1] = row[1]

//         let resultJson = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r",""));

//         let x = 0;
//         for (let field in resultJson) {
//             let value = resultJson[field];
//             console.log(`${field}: ${value}`);
//             newrow[headers.length + x] = value;
//             x = x+1;
//         }

//         // newrow[headers.length + 0] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).gap;
//         // newrow[headers.length + 1] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).recommendation;
//         // newrow[headers.length + 2] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).compliance;
//         // newrow[headers.length + 3] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).evidence;
//         // newrow[gapIndex] = row[gapIndex];
//         // newrow[recIndex] = row[recIndex];
//         if (newHeader.length == 0) {
//             for (let header of headers) {
//                 newHeader.push(header);
//             }
//             for (let field in resultJson) {
//                 newHeader.push(field);
//             }
//             matrix.push(newHeader);
//         }
//         matrix.push(newrow)
        
//         console.log(`aiResponse end`)
//     }


//     let workbook = new ExcelJS.Workbook();
//     let worksheet = workbook.addWorksheet('Sheet 1');

//     // Set column properties
//     worksheet.columns = [
//         { header: 'Header1', key: 'header1', width: 10 },
//         { header: 'Header2', key: 'header2', width: 20 },
//         { header: 'Header3', key: 'header3', width: 30 },
//     ];
//     let row = worksheet.addRow({header1: 'value1', header2: 'value2', header3: 'long value that needs to be wrapped'});

//     // Set wrap text alignment in a specific cell
//     row.getCell(3).alignment = { wrapText: true };
//     // TODO: wrap text

//     await workbook.xlsx.writeFile('Result.xlsx')
//         .then(() => console.log('Excel file created successfully.'))
//         .catch((error) => console.error(error));

//     console.log(`matrix: ${JSON.stringify(matrix)}`)
//     let buffer = xlsx.build([{name: "MySheet2", data: matrix}]); 
//     fs.writeFileSync('Result.xlsx', buffer, 'binary'); 

//     // res.download('result.xlsx');

//     res.sendStatus(200);
// });

// app.post('/api/process', upload.single('file'), async (req, res) => {
//     let file = req.file;
//     let template = req.body.template;

//     let obj = xlsx.parse(file.path);
//     let data = obj[0].data;

//     // Assume first row is the header
//     let headers = data[0];

//     // Find index of 'Gap' and 'Recommendation' columns
//     let gapIndex = headers.indexOf('control');
//     let recIndex = headers.indexOf('evidence');
//     let xIndex = headers.indexOf('xx');
//     console.log(`xIndex = ${xIndex}`);

//     let matrix = [];
//     // Loop from second row (exclude header)
//     for (let i = 1; i < data.length; i++) {
//         row = data[i];
//         let control = row[0];
//         let evidence = row[1];

//         let prompt = template.replace("{{control}}", control).replace("{{evidence}}", evidence);
            
//         let str = template;

//         let regex = /{{(.*?)}}/g;
//         let matches = str.match(regex);

//         if (matches) {
//             matches = matches.map(function(match) {
//                 // Remove the curly braces from each match
//                 return match.slice(2, -2).trim();
//             });
//         }
//         console.log(`matches: ${JSON.stringify(matches)}`)

            
//         let response = await axios.post('https://api.openai.com/v1/chat/completions', {
//             "messages": [{"role": "user", "content": prompt}],
//             "model": "gpt-3.5-turbo",
//             max_tokens: 2000
//         }, {
//             headers: {
//                 'Authorization': 'Bearer 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',
//                 'Content-Type': 'application/json'
//             }
//         });
        
//         let aiResponse = response.data; // Assuming this is the response format
//         console.log(`aiResponse: ${JSON.stringify(aiResponse)}`)
//         // Add AI response to corresponding columns in row

//         let newrow = []
//         // newrow.push("HELLO")
//         console.log(`gapIndex: ${gapIndex}`)
//         console.log(`recIndex: ${recIndex}`)

//         newrow[0] = row[0]
//         newrow[1] = row[1]
//         newrow[headers.length + 0] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).gap;
//         newrow[headers.length + 1] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).recommendation;
//         newrow[headers.length + 2] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).compliance;
//         newrow[headers.length + 3] = JSON.parse(aiResponse.choices[0].message.content.replace("\n","").replace("\r","")).evidence;
//         // newrow[gapIndex] = row[gapIndex];
//         // newrow[recIndex] = row[recIndex];
//         matrix.push(newrow)
        
//         console.log(`aiResponse end`)
//     }

//     console.log(`matrix: ${JSON.stringify(matrix)}`)
//     let buffer = xlsx.build([{name: "MySheet2", data: matrix}]); 
//     fs.writeFileSync('Result.xlsx', buffer, 'binary'); 

//     res.sendStatus(200);
// });

app.get('/api/download', (req, res) => {
  res.download(`${process.env.XLSX_OUTPUT_PATH || result.xlsx}`);
});


app.use(express.static('public'));
