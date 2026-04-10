// data_quality_config.js
// Loaded via <dashboard script="data_quality_config.js">.
//
// Uses real HTML buttons (no <single> panels) and runs all writes via
// oneshotSearch (REST) so outputlookup never appears in a dashboard search —
// zero safe_mode warnings regardless of Splunk config.

require(['splunkjs/mvc', 'jquery', 'splunkjs/ready!'], function (mvc, $) {
    var svc       = mvc.createService();
    var tokens    = mvc.Components.getInstance('default');
    var submitted = mvc.Components.getInstance('submitted');

    // ── Token helpers ─────────────────────────────────────────────────────────
    function getToken(name) {
        var v = tokens.get(name);
        if (v !== undefined && v !== null) return String(v);
        if (submitted) v = submitted.get(name);
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

    // ── SPL helpers ───────────────────────────────────────────────────────────
    function runSpl(spl, done) {
        svc.oneshotSearch(
            spl,
            { earliest_time: '-1m', latest_time: 'now', output_mode: 'json', count: 0 },
            function (err) { done(err); }
        );
    }
    function escSpl(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // ── Table refresh ─────────────────────────────────────────────────────────
    function refreshTable() {
        var sm = mvc.Components.getInstance('excl_search');
        if (sm && sm.startSearch) sm.startSearch();
    }

    // ── Toast notification ────────────────────────────────────────────────────
    var _toastTimer;
    function showToast(msg, isError) {
        var $t = $('#dq-toast');
        if (!$t.length) {
            $t = $('<div id="dq-toast"></div>').appendTo('body');
        }
        $t.text(msg)
          .removeClass('dq-toast-ok dq-toast-err')
          .addClass(isError ? 'dq-toast-err' : 'dq-toast-ok')
          .show();
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { $t.fadeOut(400); }, isError ? 5000 : 2500);
    }

    // ── Button click handlers (delegated — panels render async) ───────────────
    $(document.body).on('click', '#dq-add-btn', function () {
        setToken('dq_do_add', '1');
    });
    $(document.body).on('click', '#dq-confirm-del', function () {
        setToken('dq_do_del', '1');
    });
    $(document.body).on('click', '#dq-cancel-del', function () {
        clearToken('dq_del_st');
    });

    // Update confirmation label when dq_del_st changes
    tokens.on('change:dq_del_st', function () {
        var st = getToken('dq_del_st');
        if (st) $('#dq-del-label').text('Remove "' + st + '" from exclusions?');
    });

    // ── Add ───────────────────────────────────────────────────────────────────
    tokens.on('change:dq_do_add', function () {
        if (!tokens.get('dq_do_add')) return;
        clearToken('dq_do_add');

        var st     = getToken('dq_add_st').trim();
        var reason = getToken('dq_add_reason').trim();
        if (!st) return;

        setToken('dq_busy', '1');

        var spl = '| inputlookup data_quality_exclusions' +
            ' | append [| makeresults | eval sourcetype="' + escSpl(st) + '", reason="' + escSpl(reason) + '" | fields sourcetype reason]' +
            ' | dedup sourcetype | sort sourcetype | outputlookup data_quality_exclusions';

        runSpl(spl, function (err) {
            clearToken('dq_busy');
            if (err) { showToast('Error saving: ' + err, true); return; }
            clearToken('dq_add_st');
            clearToken('dq_add_reason');
            showToast('Saved \u2713');
            refreshTable();
        });
    });

    // ── Delete ────────────────────────────────────────────────────────────────
    tokens.on('change:dq_do_del', function () {
        if (!tokens.get('dq_do_del')) return;
        clearToken('dq_do_del');

        var st = getToken('dq_del_st').trim();
        if (!st) return;

        setToken('dq_busy', '1');

        runSpl(
            '| inputlookup data_quality_exclusions | where sourcetype!="' + escSpl(st) + '" | outputlookup data_quality_exclusions',
            function (err) {
                clearToken('dq_busy');
                clearToken('dq_del_st');
                if (err) { showToast('Error removing: ' + err, true); return; }
                showToast('Removed \u2713');
                refreshTable();
            }
        );
    });
});
