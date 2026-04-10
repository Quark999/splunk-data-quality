// data_quality_config.js
// Loaded via <dashboard script="data_quality_config.js">.
// Handles all add/remove logic for the exclusion manager using
// splunkjs SDK oneshotSearch — no dashboard search, no safe_mode prompt.

require(['splunkjs/mvc', 'jquery', 'splunkjs/ready!'], function (mvc, $) {
    var svc = mvc.createService();
    var pendingDelete = null;

    function runSpl(spl, done) {
        svc.oneshotSearch(
            spl,
            { earliest_time: '-1m', latest_time: 'now', output_mode: 'json', count: 1000 },
            function (err, data) { done(err, (data && data.results) ? data.results : []); }
        );
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escJs(s)  { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
    function escSpl(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

    window.dqLoad = function () {
        $('#dq-loading').show();
        $('#dq-tbl, #dq-empty, #dq-err').hide();

        runSpl('| inputlookup data_quality_exclusions | sort sourcetype', function (err, rows) {
            $('#dq-loading').hide();
            if (err) { $('#dq-err').text('Error loading exclusions: ' + err).show(); return; }

            var tbody = $('#dq-tbody').empty();
            if (!rows.length) { $('#dq-empty').show(); return; }

            rows.forEach(function (r, i) {
                var st = r.sourcetype || '', reason = r.reason || '';
                tbody.append(
                    '<tr style="border-bottom:1px solid #1e1e1e">' +
                    '<td style="padding:8px 12px;color:#555;font-size:12px">' + (i + 1) + '</td>' +
                    '<td style="padding:8px 12px;color:#ddd;font-family:monospace">' + esc(st) + '</td>' +
                    '<td style="padding:8px 12px;color:#888">' + esc(reason) + '</td>' +
                    '<td style="padding:8px 12px;text-align:right">' +
                      '<button onclick="dqStartDel(\'' + escJs(st) + '\')" ' +
                        'style="padding:4px 10px;background:transparent;border:1px solid #6b2020;border-radius:3px;color:#dc4e41;font-size:12px;cursor:pointer">' +
                        'Remove</button>' +
                    '</td></tr>'
                );
            });
            $('#dq-tbl').show();
        });
    };

    window.dqAdd = function () {
        var st     = $('#dq-st').val().trim();
        var reason = $('#dq-reason').val().trim();
        if (!st) { $('#dq-st').css('border-color', '#dc4e41').focus(); return; }
        $('#dq-st').css('border-color', '#333');
        $('#dq-add-btn').prop('disabled', true).text('Saving\u2026');
        $('#dq-ok, #dq-add-err').hide();

        var spl = '| inputlookup data_quality_exclusions' +
            ' | append [| makeresults | eval sourcetype="' + escSpl(st) + '", reason="' + escSpl(reason) + '" | fields sourcetype reason]' +
            ' | dedup sourcetype | sort sourcetype | outputlookup data_quality_exclusions';

        runSpl(spl, function (err) {
            $('#dq-add-btn').prop('disabled', false).text('+ Add');
            if (err) { $('#dq-add-err').text('Error: ' + err).show(); return; }
            $('#dq-st').val(''); $('#dq-reason').val('');
            $('#dq-ok').show();
            setTimeout(function () { $('#dq-ok').fadeOut(); }, 3000);
            dqLoad();
        });
    };

    window.dqStartDel = function (st) {
        pendingDelete = st;
        document.getElementById('dq-del-label').textContent = st;
        document.getElementById('dq-confirm').style.display = 'block';
    };

    window.dqCancelDel = function () {
        pendingDelete = null;
        document.getElementById('dq-confirm').style.display = 'none';
    };

    window.dqConfirmDel = function () {
        if (!pendingDelete) return;
        var st = pendingDelete;
        dqCancelDel();
        runSpl(
            '| inputlookup data_quality_exclusions | where sourcetype!="' + escSpl(st) + '" | outputlookup data_quality_exclusions',
            function (err) {
                if (err) { alert('Error removing exclusion: ' + err); return; }
                dqLoad();
            }
        );
    };

    // Initial load
    dqLoad();
});
