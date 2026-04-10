# Data Quality — Log Source Entropy Monitor

A lightweight Splunk app that detects degraded or stuck log sources by tracking **punct pattern diversity** (`dc(punct)`) per sourcetype. When a source starts sending the same repeated message (e.g. a looping error), its punct entropy collapses — this app flags it.

No TA dependency. Works universally across any Splunk environment.

---

## How It Works

Splunk automatically computes the `punct` field for every event at search time. `punct` is a punctuation-only fingerprint of the raw event (e.g. `--_::._+____-_=,_=`). Healthy log sources produce many distinct patterns over time. A stuck or degraded source produces only one or two.

The app counts **distinct punct patterns per sourcetype per hour** (`dc(Events.punct)`). Sources below a configurable threshold are flagged.

---

## What's Included

| Component | Description |
|-----------|-------------|
| `Data_Quality` data model | BaseEvent model with `punct` field, acceleration enabled (7d, `*/5 * * * *`) |
| `data_quality_entropy` dashboard | Dark-theme dashboard with KPIs, detail table, time chart, and heatmap |
| `Data Quality - Low Entropy Sources` saved search | Hourly alert for sourcetypes with `dc(punct) < 5` |

---

## Dashboard Panels

- **Sources Below Entropy Threshold** — count of affected sourcetypes
- **Total Events from Flagged Sources** — volume impact of low-entropy sources
- **Top Offender** — highest-volume low-entropy sourcetype
- **Detail Table** — avg and latest distinct punct/hr per sourcetype with colour coding
- **Entropy Over Time** — line chart showing punct diversity per sourcetype over the selected range
- **Entropy Heatmap** — bar chart of avg entropy by sourcetype × hour of day

The threshold is configurable from the dashboard (default: 5 distinct punct patterns).

---

## Requirements

- Splunk Enterprise 8.x or later (tested on 10.x with ES 8.x)
- No TAs or add-ons required
- Works on standalone or distributed deployments

---

## Installation

### Option A — Install from tarball (recommended)

1. Download `splunk-data-quality-<version>.tar.gz` from [Releases](../../releases)
2. In Splunk Web: **Apps → Manage Apps → Install app from file**
3. Upload the tarball — no restart required

### Option B — Clone and install manually

```bash
git clone https://github.com/Quark999/splunk-data-quality.git
cp -r splunk-data-quality/data_quality $SPLUNK_HOME/etc/apps/
chown -R splunk:splunk $SPLUNK_HOME/etc/apps/data_quality
$SPLUNK_HOME/bin/splunk reload deploy-server
```

---

## Configuration

### Acceleration

Enabled by default at `-7d` with a `*/5 * * * *` cron schedule. On first install, the initial tsidx build may take several minutes. The dashboard queries work immediately via raw search while the tsidx builds.

To adjust the retention window, edit `default/datamodels.conf`:

```ini
[Data_Quality]
acceleration.earliest_time = -7d
acceleration.cron_schedule = */5 * * * *
```

### Alert Threshold

The saved search alert fires when any sourcetype has fewer than 5 distinct punct patterns per hour. Adjust in `default/savedsearches.conf`:

```ini
search = ... | where entropy_proxy < 5 | ...
```

Or change it interactively from the dashboard threshold input.

---

## What Good vs Bad Looks Like

| Sourcetype | Distinct punct/hr | Status |
|------------|-------------------|--------|
| `splunkd` | 500–1000+ | Healthy — many log formats |
| `WinEventLog` | 50–500 | Healthy — varied event types |
| `some_app` | 1 | **Flagged** — likely stuck on one message |
| `syslog_feed` | 2 | **Flagged** — investigate |

A threshold of 5 is conservative. Tune it based on your environment — some sources (e.g. metrics feeds) legitimately have low variety.

---

## License

MIT
