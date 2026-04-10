// data_quality_config.js
// All interactive UI (Add button, delete confirmation) is injected into the
// page via JS — avoids <html> panel rendering issues across Splunk versions.
// All writes go via oneshotSearch (REST) — no outputlookup in XML searches,
// no safe_mode warnings regardless of Splunk instance configuration.

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
    function clearToken(name) { tokens.unset(name); if (submitted) submitted.unset(name); }
    function setToken(name, val) { tokens.set(name, val); if (submitted) submitted.set(name, val); }

    // Cache fieldset input values ourselves — Splunk's submitted model can
    // drop these values after unrelated token mutations (e.g. clearToken on
    // dq_del_st triggers a form re-evaluation that clears other tokens).
    // We watch the default model directly so we always have the latest value.
    var _addSt     = getToken('dq_add_st');
    var _addReason = getToken('dq_add_reason');
    tokens.on('change:dq_add_st',     function () { var v = tokens.get('dq_add_st');     if (v != null) _addSt     = String(v); });
    tokens.on('change:dq_add_reason', function () { var v = tokens.get('dq_add_reason'); if (v != null) _addReason = String(v); });

    // ── SPL helpers ───────────────────────────────────────────────────────────
    function runSpl(spl, done) {
        svc.oneshotSearch(spl,
            { earliest_time: '-1m', latest_time: 'now', output_mode: 'json', count: 0 },
            function (err) { done(err); });
    }
    function escSpl(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

    function refreshTable() {
        var sm = mvc.Components.getInstance('excl_search');
        if (sm && sm.startSearch) sm.startSearch();
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    var _toastTimer;
    function showToast(msg, isError) {
        var $t = $('#dq-toast');
        if (!$t.length) $t = $('<div id="dq-toast"></div>').appendTo('body');
        $t.text(msg).removeClass('dq-toast-ok dq-toast-err')
          .addClass(isError ? 'dq-toast-err' : 'dq-toast-ok').show();
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { $t.fadeOut(400); }, isError ? 5000 : 2500);
    }

    // ── Inject UI above the table row ─────────────────────────────────────────
    // Build the UI element once; injectUI retries until the DOM anchor exists.
    // autoRun="false" dashboards render rows later than autoRun="true" ones,
    // so a single setTimeout isn't reliable — we retry until it lands.
    var $dqUI = $(
        '<div id="dq-ui" style="padding: 0 12px 12px;">' +
          '<div id="dq-add-bar">' +
            '<button class="btn btn-primary btn-sm" id="dq-add-btn">+ Add to Exclusion List</button>' +
          '</div>' +
          '<div id="dq-del-bar" style="display:none;">' +
            '<span id="dq-del-label" style="margin-right:12px; font-weight:600;"></span>' +
            '<button class="btn btn-destructive btn-sm" id="dq-confirm-del">&#10003; Confirm Remove</button>' +
            '&nbsp;' +
            '<button class="btn btn-default btn-sm" id="dq-cancel-del">&#10007; Cancel</button>' +
          '</div>' +
        '</div>'
    );

    function injectUI() {
        if ($('#dq-ui').length) return; // already injected
        var $firstRow = $('.main-section-body .dashboard-row').first();
        if ($firstRow.length) {
            $firstRow.before($dqUI);
        } else if ($('.main-section-body').length) {
            $('.main-section-body').prepend($dqUI);
        } else {
            setTimeout(injectUI, 300); // neither anchor exists yet — retry
        }
    }

    setTimeout(injectUI, 200);

    // ── Button click handlers (delegated) ─────────────────────────────────────
    $(document.body).on('click', '#dq-add-btn', function () {
        setToken('dq_do_add', '1');
    });
    $(document.body).on('click', '#dq-confirm-del', function () {
        setToken('dq_do_del', '1');
    });
    $(document.body).on('click', '#dq-cancel-del', function () {
        clearToken('dq_del_st');
        showAddBar();
    });

    // ── Show/hide helpers — called directly; don't rely on token event chain ──
    function showDelBar(st) {
        $('#dq-del-label').text('Remove "' + st + '" from exclusions?');
        $('#dq-add-bar').hide();
        $('#dq-del-bar').show();
    }
    function showAddBar() {
        $('#dq-del-bar').hide();
        $('#dq-add-bar').show();
    }

    // Also respond to token changes (handles the case where a row is clicked
    // via the XML drilldown, which sets the token without going through our JS)
    tokens.on('change:dq_del_st', function () {
        var st = tokens.get('dq_del_st'); // check default model directly, not via getToken
        if (st) { showDelBar(st); } else { showAddBar(); }
    });

    // ── Add ───────────────────────────────────────────────────────────────────
    tokens.on('change:dq_do_add', function () {
        if (!tokens.get('dq_do_add')) return;
        clearToken('dq_do_add');

        var st     = _addSt.trim();
        var reason = _addReason.trim();
        if (!st) { showToast('Enter a sourcetype first', true); return; }

        $('#dq-add-btn').prop('disabled', true).text('Saving\u2026');

        var spl = '| inputlookup data_quality_exclusions' +
            ' | append [| makeresults | eval sourcetype="' + escSpl(st) + '", reason="' + escSpl(reason) + '" | fields sourcetype reason]' +
            ' | dedup sourcetype | sort sourcetype | outputlookup data_quality_exclusions';

        runSpl(spl, function (err) {
            $('#dq-add-btn').prop('disabled', false).text('+ Add to Exclusion List');
            if (err) { showToast('Error saving: ' + err, true); return; }
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

        $('#dq-confirm-del').prop('disabled', true).text('Removing\u2026');

        runSpl(
            '| inputlookup data_quality_exclusions | where sourcetype!="' + escSpl(st) + '" | outputlookup data_quality_exclusions',
            function (err) {
                $('#dq-confirm-del').prop('disabled', false).text('\u2713 Confirm Remove');
                clearToken('dq_del_st');
                showAddBar(); // update DOM directly — don't rely on token event chain
                if (err) { showToast('Error removing: ' + err, true); return; }
                showToast('Removed \u2713');
                refreshTable();
            }
        );
    });
});
