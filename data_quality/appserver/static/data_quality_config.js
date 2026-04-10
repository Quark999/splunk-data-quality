// data_quality_config.js
// Loaded via <dashboard script="data_quality_config.js">.
// Listens for token changes set by single-value panel drilldowns,
// then runs outputlookup via the SDK REST API — no dashboard search,
// no safe_mode prompt.

require(['splunkjs/mvc', 'splunkjs/ready!'], function (mvc) {
    var svc    = mvc.createService();
    var tokens = mvc.Components.getInstance('default');
    var submitted = mvc.Components.getInstance('submitted');

    function getToken(name) {
        var v = tokens.get(name);
        if (v !== undefined && v !== null) return String(v);
        if (submitted) { v = submitted.get(name); }
        return (v !== undefined && v !== null) ? String(v) : '';
    }

    function clearToken(name) {
        tokens.unset(name);
        if (submitted) submitted.unset(name);
    }

    function setToken(name, val) {
        tokens.set(name, val);
        if (submitted) submitted.set(name, val);
    }

    function runSpl(spl, done) {
        svc.oneshotSearch(
            spl,
            { earliest_time: '-1m', latest_time: 'now', output_mode: 'json', count: 0 },
            function (err) { done(err); }
        );
    }

    function refreshTable() {
        var sm = mvc.Components.getInstance('excl-search');
        if (sm && sm.startSearch) sm.startSearch();
    }

    function escSpl(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // ── Add ──────────────────────────────────────────────────────────────────
    tokens.on('change:dq_do_add', function () {
        if (!tokens.get('dq_do_add')) return;
        clearToken('dq_do_add');

        var st     = getToken('dq_add_st').trim();
        var reason = getToken('dq_add_reason').trim();
        if (!st) return;

        setToken('dq_msg', 'Saving\u2026');

        var spl = '| inputlookup data_quality_exclusions' +
            ' | append [| makeresults | eval sourcetype="' + escSpl(st) + '", reason="' + escSpl(reason) + '" | fields sourcetype reason]' +
            ' | dedup sourcetype | sort sourcetype | outputlookup data_quality_exclusions';

        runSpl(spl, function (err) {
            if (err) { setToken('dq_msg', 'Error saving'); return; }
            setToken('dq_msg', 'Saved \u2713');
            clearToken('dq_add_st');
            clearToken('dq_add_reason');
            setTimeout(function () { clearToken('dq_msg'); }, 3000);
            refreshTable();
        });
    });

    // ── Delete ───────────────────────────────────────────────────────────────
    tokens.on('change:dq_do_del', function () {
        if (!tokens.get('dq_do_del')) return;
        clearToken('dq_do_del');

        var st = getToken('dq_del_st').trim();
        if (!st) return;

        runSpl(
            '| inputlookup data_quality_exclusions | where sourcetype!="' + escSpl(st) + '" | outputlookup data_quality_exclusions',
            function (err) {
                if (err) { alert('Error removing exclusion: ' + err); return; }
                clearToken('dq_del_st');
                refreshTable();
            }
        );
    });
});
