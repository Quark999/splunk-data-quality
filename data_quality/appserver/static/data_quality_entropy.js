// data_quality_entropy.js
// Injects a compact "Clear" button when a sourcetype row is selected,
// replacing the old <single> panel approach that rendered full-width.

require(['splunkjs/mvc', 'jquery', 'splunkjs/ready!'], function (mvc, $) {
    var tokens    = mvc.Components.getInstance('default');
    var submitted = mvc.Components.getInstance('submitted');

    function getToken(name) {
        var v = tokens.get(name);
        if (v !== undefined && v !== null) return String(v);
        if (submitted) v = submitted.get(name);
        return (v !== undefined && v !== null) ? String(v) : '';
    }
    function clearToken(name) { tokens.unset(name); if (submitted) submitted.unset(name); }

    // When selected_sourcetype is set, inject a small Clear button above the
    // inspect panels. When unset, remove it.
    tokens.on('change:selected_sourcetype', function () {
        var st = getToken('selected_sourcetype');

        $('#dq-clear-bar').remove();

        if (st) {
            var $bar = $(
                '<div id="dq-clear-bar" style="padding: 4px 12px 8px;">' +
                  '<span style="margin-right: 12px; font-size: 13px; opacity: 0.8;">Inspecting: <strong>' +
                    $('<span>').text(st).html() + // safely escape the sourcetype name
                  '</strong></span>' +
                  '<button class="btn btn-default btn-sm" id="dq-clear-btn">&#10007; Clear</button>' +
                '</div>'
            );

            // Insert before the first depends row (the inspect panels row).
            // These rows are rendered by Splunk when the token is set; wait a
            // tick to ensure they exist in the DOM before prepending.
            setTimeout(function () {
                var $inspectRows = $('.main-section-body .dashboard-row').filter(function () {
                    // Find rows that appeared after the detail table — the inspect rows
                    return $(this).find('.panel-title').text().indexOf('Inspecting') !== -1 ||
                           $(this).find('.panel-title').text().indexOf('Punct Pattern') !== -1 ||
                           $(this).find('.panel-title').text().indexOf('Sample Events') !== -1;
                }).first();

                if ($inspectRows.length) {
                    $inspectRows.before($bar);
                } else {
                    // Fallback: find first depends row after the detail table
                    $('.main-section-body .dashboard-row').eq(1).after($bar);
                }
            }, 150);
        }
    });

    $(document.body).on('click', '#dq-clear-btn', function () {
        clearToken('selected_sourcetype');
    });
});
