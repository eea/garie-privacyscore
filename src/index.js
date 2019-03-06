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

function getResults(file) {
    const dom = new JSDOM(file);

    const critical = dom.window.document.querySelectorAll(".col>.color-critical").length;
    const bad = dom.window.document.querySelectorAll(".col>.color-bad").length;
    const neutral = dom.window.document.querySelectorAll(".col>.color-neutral").length;
    const good = dom.window.document.querySelectorAll(".col>.color-good").length;

    var score = 0;
    if (critical === 0){
        const total = critical + bad + good;
        score = good / total * 100;
    }

    var result = {};
    if (!isNaN(score)){
        result['privacyscore'] = score;
    }

    return result;
}

const triggerPrivacyScoreScan = async (url) => {
    return new Promise(async (resolve, reject) => {
        try {
            //first go to https://privacyscore.org to get the xsrftoken and xsrfmiddlewaretoken
            var response;
            response = await request({
                method: 'GET',
                uri: privacyscore_base,
                resolveWithFullResponse: true
            });

            const dom = new JSDOM(response.body);
            const csrfmiddlewaretoken = dom.window.document.querySelector("input[name='csrfmiddlewaretoken']").value;

            const cookies = response.headers['set-cookie'];
            var csrftoken = '';
            var regex = RegExp("\csrftoken=(.*?)\;");
            cookies.forEach(function(cookie){
                if (cookie.startsWith('csrftoken')){
                    csrftoken = regex.exec(cookie)[1];
                }
            });

            //create the scan job on https://privacyscore.org
            const scan_uri = privacyscore_base + "site/scan/";

            var headers = {
                'Cookie': 'csrftoken='+csrftoken,
                'Referer': 'https://privacyscore.org/',
                'X-CSRFToken': csrftoken
            };

            response = await request({
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

            //periodically get the status of the scan job
            const redirect_to = response.request.uri.path.split("/");
            const results_uri = privacyscore_base + "site/" + redirect_to[2];


            while(true){
                response = await request({
                    method: 'GET',
                    uri: results_uri,
                    resolveWithFullResponse: true
                });
                if (!response.body.includes("SCAN IN PROGRESS")){
                    break;
                }
                await sleep(500)
            }
            resolve(results_uri);
        } catch (err) {
            console.log(`Failed to trigger the scan for ${url}`, err);
            reject(`Failed to trigger the scan for ${url}`);
        }
    });
}

const getHtmlData = async (results_url, folder) => {
    return new Promise(async (resolve, reject) => {
        try {
            // scrape the results url and save it to folder
            const options = {
                urls: [{url: results_url, filename: 'privacyscore.html'},],
                directory: folder
            };

            const html_result = await scrape(options);

            var html_data = html_result[0].text;

            //add extra style to hide the header/footer in our reports
            html_data = html_data.replace("</html>","<style type='text/css'>.navbar,.col-sm-4,.footer{display:none !important;} .col-md-4{display:block !important;}</style></html>");

            var html_file = path.join(folder, 'privacyscore.html');

            fs.outputFile(html_file, html_data)
            .catch(err => {
              console.log(err);
            })
            resolve (html_data);
        } catch (err) {
            console.log(`Failed to save html report`, err);
            reject(`Failed to save html report`);
        }
    });
}

const getJsonData = async (results_url, folder) => {
    return new Promise(async (resolve, reject) => {
        try {
            // privacyscore.org only provides a highlighted json, so we have to transform in raw JSON
            const json_url = results_url + "/json/";
            const response = await request({
                method: 'GET',
                uri: json_url,
                resolveWithFullResponse: true
            });
            const dom = new JSDOM(response.body);
            const text_data = dom.window.document.querySelector(".highlight").textContent;
            const json_data = JSON.parse(text_data);

            var json_file = path.join(folder, 'privacyscore.json');

            fs.outputJson(json_file, json_data, {spaces: 2})
            .catch(err => {
              console.log(err);
            })
            resolve ({});
        } catch (err) {
            console.log(`Failed to save json report`, err);
            reject(`Failed to save json report`);
        }
    });
}

const getData = async (item) => {
    const { url } = item.url_settings;
    return new Promise(async (resolve, reject) => {
        try {
            const { reportDir } = item;
            const reportFolder = garie_plugin.utils.helpers.reportDirNow(reportDir);

            const results_url = await triggerPrivacyScoreScan(url);

            const html_data = await getHtmlData(results_url, reportFolder);
            await getJsonData(results_url, reportFolder);

            const result = getResults(html_data);

            resolve(result);
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
