# Garie privacyscore plugin

<p align="center">
  <p align="center">Tool to gather privacyscore metrics and supports CRON jobs.<p>
</p>

**Highlights**

-   Poll for [privacyscore](https://privacyscore.org/) statistics on any website and stores the data into InfluxDB
-   View all historic privacyscore reports in HTML and JSON format.
-   Setup within minutes

## Overview of garie-privacyscore

Garie-privacyscore was developed as a plugin for the [Garie](https://github.com/boyney123/garie) Architecture.

[Garie](https://github.com/boyney123/garie) is an out the box web performance toolkit, and `garie-privacyscore` is a plugin that generates and stores [privacyscore](https://privacyscore.org/) data into `InfluxDB`.

`Garie-privacyscore` can also be run outside the `Garie` environment and run as standalone.

If your interested in an out the box solution that supports multiple performance tools like `lighthouse`, `google-speed-insight` and `web-page-test` then checkout [Garie](https://github.com/boyney123/garie).

If you want to run `garie-privacyscore` standalone you can find out how below.

## Getting Started

### Prerequisites

-   Docker installed

### Running garie-privacyscore

You can get setup with the basics in a few minutes.

First clone the repo.

```sh
git clone https://github.com/eea/garie-privacyscore.git
```

Next setup you're config. Edit the `config.json` and add websites to the list.

```javascript
{
  "plugins":{
        "privacyscore":{
            "cron": "0 */4 * * *"
        }
    },
  "urls": [
    {
      "url": "https://www.eea.europa.eu/"
    },
    {
      "url": "https://biodiversity.europa.eu/"
    }
  ]
}
```

Once you finished edited your config, lets setup our environment.

```sh
docker-compose up
```

This will run the application.

On start garie-privacyscore will start to gather statistics for the websites added to the `config.json`.


## config.json

| Property | Type                | Description                                                                          |
| -------- | ------------------- | ------------------------------------------------------------------------------------ |
| `cron`   | `string` (optional) | Cron timer. Supports syntax can be found [here].(https://www.npmjs.com/package/cron) |
| `plugins.privacyscore.cron`   | `string` (optional) | Cron timer. Supports syntax can be found [here].(https://www.npmjs.com/package/cron) |
| `plugins.privacyscore.retry`   | `object` (optional) | Configuration how to retry the failed tasks |
| `plugins.privacyscore.retry.after`   | `number` (optional, default 30) | Minutes before we retry to execute the tasks |
| `plugins.privacyscore.retry.times`   | `number` (optional, default 3) | How many time to retry to execute the failed tasks |
| `plugins.privacyscore.retry.timeRange`   | `number` (optional, default 360) | Period in minutes to be checked in influx, to know if a task failed |
| `plugins.privacyscore.timeout`   | `number` (optional, default 10) | Timeout until we retry to get the generated result page from [privacyscore](https://privacyscore.org/ |
| `urls`   | `object` (required) | Config for privacyscore. More detail below                                           |

**urls object**

| Property                                | Type                 | Description                                               |
| --------------------------------------- | -------------------- | --------------------------------------------------------- |
| `url`                                   | `string` (required)  | Url to get privacyscore statistics for.                   |
