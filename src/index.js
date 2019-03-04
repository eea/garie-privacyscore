const garie_plugin = require('garie-plugin')
const path = require('path');
const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const serveIndex = require('serve-index');
const fs = require('fs-extra');
const request = require('request-promise');
const sleep = require('sleep-promise');
const scrape = require('website-scraper');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const privacyscore_base = 'https://privacyscore.org/'
const getData = async (item) => {
    const { url } = item.url_settings;
    return new Promise(async (resolve, reject) => {
        try {
            const { reportDir } = item;
            const reportFolder = garie_plugin.utils.helpers.reportDirNow(reportDir);

            const scan_uri = privacyscore_base + "site/scan/";

            const base_resp = await request({
                method: 'GET',
                uri: privacyscore_base,
                resolveWithFullResponse: true
            });

            const dom = new JSDOM(base_resp.body);
            const csrfmiddlewaretoken = dom.window.document.querySelector("input[name='csrfmiddlewaretoken']").value;

            const cookies = base_resp.headers['set-cookie'];
            var csrftoken = '';
            var regex = RegExp("\csrftoken=(.*?)\;");
            cookies.forEach(function(cookie){
                if (cookie.startsWith('csrftoken')){
                    csrftoken = regex.exec(cookie)[1];
                }
            });

            var headers = {
                'Cookie': 'csrftoken='+csrftoken,
                'Referer': 'https://privacyscore.org/',
                'X-CSRFToken': csrftoken
            };

            const response = await request({
                method: 'POST',
                uri: scan_uri,
                form: {
                  'url': url,
                  'csrfmiddlewaretoken': csrfmiddlewaretoken
                },
                headers: headers,
                resolveWithFullResponse: true,
                followAllRedirects: true
            });

            const redirect_to = response.request.uri.path.split("/");
            const results_uri = privacyscore_base + "site/" + redirect_to[2];

            var results_response;
            while(true){
                results_response = await request({
                    method: 'GET',
                    uri: results_uri,
                    resolveWithFullResponse: true
                });
                if (!results_response.body.includes("SCAN IN PROGRESS")){
                    break;
                }
                await sleep(500)
            }
            const options = {
                urls: [{url: results_uri, filename: 'privacyscore.html'},],
                directory: reportFolder,
            };
            const page_result = await scrape(options);

            var html_data = page_result[0].text;

            html_data = html_data.replace("</html>","<style type='text/css'>.navbar,.col-sm-4,.footer{display:none !important;} .col-md-4{display:block !important;}</style></html>");

            var html_file = path.join(reportFolder, 'privacyscore.html');

            fs.outputFile(html_file, html_data)
            .then(() => console.log(`Saved privacyscore html file for ${url}`))
            .catch(err => {
              console.log(err)
            })

            const data = {};
            resolve(data);
        } catch (err) {
            console.log(`Failed to get data for ${url}`, err);
            reject(`Failed to get data for ${url}`);
        }
    });
};



console.log("Start");


const app = express();
app.use('/reports', express.static('reports'), serveIndex('reports', { icons: true }));

const main = async () => {
  garie_plugin.init({
    getData:getData,
    db_name:'privacyscore',
    plugin_name:'privacyscore',
    report_folder_name:'privacyscore-results',
    app_root: path.join(__dirname, '..'),
    config:config

  });
}

if (process.env.ENV !== 'test') {
  app.listen(3000, async () => {
    console.log('Application listening on port 3000');
    await main();
  });
}
