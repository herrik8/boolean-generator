$(document).ready(function() {
    // Default excluded sites
    const DEFAULT_EXCLUDED_SITES = [
        'spokeo.com',
        'intelius.com',
        'whitepages.com',
        'anywho.com',
        'beenverified.com',
        'truthfinder.com',
        'instantcheckmate.com',
        'peoplefinder.com',
        'infotracer.com',
        'fastpeoplesearch.com',
        'peekyou.com',
        'mylife.com',
        'zabasearch.com',
        'radaris.com',
        'peoplelooker.com',
        'ussearch.com',
        'socialcatfish.com'
    ];

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize Select2
    $('#searchTypes').select2({
        placeholder: "Select search types",
        closeOnSelect: false
    });

    // Load excluded sites from localStorage or use defaults
    let excludedSites = JSON.parse(localStorage.getItem('excludedSites')) || DEFAULT_EXCLUDED_SITES;
    $('#excludedSites').val(excludedSites.join('\n'));

    // Save exclusions button handler
    $('#saveExclusions').click(function() {
        const sites = $('#excludedSites').val().split('\n')
            .map(site => site.trim().toLowerCase())
            .filter(site => site !== '')
            .map(site => site.replace(/^www\./, ''));
        
        excludedSites = sites;
        localStorage.setItem('excludedSites', JSON.stringify(sites));
        $('#exclusionsModal').modal('hide');
    });

    // Generate Queries Button Click Handler
    $('#generateBtn').click(function() {
        const names = $('#names').val().split('\n').filter(name => name.trim() !== '');
        const selectedTypes = $('#searchTypes').val();
        const locations = $('#location').val().split('\n').filter(loc => loc.trim() !== '');
        
        if (names.length === 0 || selectedTypes.length === 0) {
            alert('Please enter at least one name and select at least one search type.');
            return;
        }

        const queries = generateQueries(names, selectedTypes, locations);
        displayQueries(queries);
        
        $('#queriesContainer').show();
        $('#openAllBtn').show();
    });

   $('#openAllBtn').click(async function() {
    const queryElements = document.querySelectorAll('.query-item');
    const delay = 500; // milliseconds between tabs

    for (const element of queryElements) {
        const query = decodeURIComponent(element.getAttribute('data-query'));
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        // Open blank tab first
        const newWindow = window.open('about:blank', '_blank');
        
        // Wait a moment then load the search URL
        await new Promise(resolve => setTimeout(resolve, delay));
        if (newWindow) {
            newWindow.location.href = searchUrl;
        }
    }
});

    // Count words in a string (considering quoted phrases as single words)
    function countWords(str) {
        // First, temporarily replace spaces within quotes with a placeholder
        let temp = str.replace(/"[^"]*"/g, match => match.replace(/\s+/g, '_'));
        // Then count remaining spaces plus 1
        return temp.trim().split(/\s+/).length;
    }

    // Generate Google Search Queries
    function generateQueries(names, selectedTypes, locations) {
        const queries = [];
        const MAX_WORDS = 32; // Google's word limit

        // Create the names part of the query
        const nameQuery = `(${names.map(name => `"${name}"`).join(' OR ')})`;
        
        // Create the locations part of the query if locations are provided
        const locationPart = locations.length > 0 ? 
            ` AND (${locations.map(loc => `"${loc}"`).join(' OR ')})` : '';

        // Create exclusion part if checkbox is checked
        const excludeAggregators = $('#excludeDataAggregators').is(':checked');
        const exclusionPart = excludeAggregators && excludedSites.length > 0 ? 
            ` ${excludedSites.map(site => `-${site}`).join(' ')}` : '';

        // Calculate how many words are used by the fixed parts of the query
        const fixedPartsWordCount = countWords(nameQuery + locationPart + exclusionPart + ' AND ()');

        for (const type of selectedTypes) {
            const keywords = KEYWORDS[type];
            
            // Split keywords into chunks that fit within Google's word limit
            let keywordGroup = [];
            let currentWordCount = fixedPartsWordCount;

            for (const keyword of keywords) {
                const newKeyword = `"${keyword}"`;
                const keywordWords = countWords(newKeyword);
                
                // Add 1 for the OR operator if not the first keyword in group
                const additionalWords = keywordGroup.length > 0 ? keywordWords + 1 : keywordWords;
                
                if (currentWordCount + additionalWords > MAX_WORDS && keywordGroup.length > 0) {
                    // Create a query with the current group of keywords
                    const query = `${nameQuery}${locationPart} AND (${keywordGroup.join(' OR ')})${exclusionPart}`;
                    queries.push({
                        type: type,
                        query: query
                    });
                    
                    // Start a new group
                    keywordGroup = [newKeyword];
                    currentWordCount = fixedPartsWordCount + keywordWords;
                } else {
                    keywordGroup.push(newKeyword);
                    currentWordCount += additionalWords;
                }
            }

            // Add the last group if it's not empty
            if (keywordGroup.length > 0) {
                const query = `${nameQuery}${locationPart} AND (${keywordGroup.join(' OR ')})${exclusionPart}`;
                queries.push({
                    type: type,
                    query: query
                });
            }
        }

        return queries;
    }

    // Display Generated Queries
    function displayQueries(queries) {
        const queriesDiv = $('#queries');
        queriesDiv.empty();

        queries.forEach((queryObj, index) => {
            const listItem = $(`
                <div class="list-group-item query-item" data-query="${encodeURIComponent(queryObj.query)}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${queryObj.type} - Part ${index + 1}</h6>
                            <p class="mb-1 text-break">${queryObj.query}</p>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-primary btn-sm copy-btn" title="Copy query">
                                <i class="copy-icon">📋</i>
                            </button>
                            <button class="btn btn-outline-success btn-sm search-btn" title="Search">
                                <i>🔍</i>
                            </button>
                        </div>
                    </div>
                </div>
            `);

            // Copy button click handler
            listItem.find('.copy-btn').click(function(e) {
                e.stopPropagation();
                navigator.clipboard.writeText(queryObj.query);
                const btn = $(this);
                btn.removeClass('btn-outline-primary').addClass('btn-primary');
                setTimeout(() => {
                    btn.removeClass('btn-primary').addClass('btn-outline-primary');
                }, 1000);
            });

            // Search button click handler
            listItem.find('.search-btn').click(function(e) {
                e.stopPropagation();
                window.open(`https://www.google.com/search?q=${encodeURIComponent(queryObj.query)}`, '_blank');
            });

            queriesDiv.append(listItem);
        });
    }
});
