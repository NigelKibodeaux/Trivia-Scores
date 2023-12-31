import http from 'http';

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });

    // Favicon
    if (req.url === '/favicon.ico') {
        res.end();
        return;
    }

    // Get the scores and format them into an HTML table.
    const scores = await getScores();
    const formatted_scores = formatScores(scores);

    res.write(formatted_scores);
    res.end();
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


async function getScores(page = 1) {
    // Purpose: Fetches the trivia data from the Geeks Who Drink website and parses it into a JSON object.
    const response = await fetch(`https://www.geekswhodrink.com/wp-admin/admin-ajax.php?action=mb_display_venue_events&pag=${page}&quiz_id=*&venue=2543192132&team=*`);
    const text = await response.text();

    // Find tables in the text and turn them into JSON objects.
    const table_text = text.match(/<table.*?>.*?<\/table>/g) || [];
    const table_objects = table_text.map(table => {
        const rows = table.match(/<tr.*?>.*?<\/tr>/g);
        const headers = rows.shift().match(/<th.*?>.*?<\/th>/g).map(header => header.replace(/<.*?>/g, ''));
        const data = rows.map(row => {
            const cells = row.match(/<td.*?>.*?<\/td>/g).map(cell => cell.replace(/<.*?>/g, ''));
            return cells.reduce((obj, cell, index) => {
                obj.set(headers[index], cell);
                return obj;
            }, new Map());
        });
        return data;
    });

    // Add the scores together from each table for each team.
    const scores = table_objects.reduce((scores_map, table, index) => {
        table.forEach(row => {
            const team_name = row.get('Team Name').replace(/\([^)]+\)/, '').trim().toUpperCase();

            // Filter out the duplicate "Centaur rodeo" score from the first week
            if (team_name === 'CENTAUR RODEO' && row.get('Score') === '32') {
                return scores_map;
            }

            if (scores_map.has(team_name)) {
                const team_scores = scores_map.get(team_name);
                team_scores.total += parseInt(row.get('Score'));
                team_scores.rounds[index] = parseInt(row.get('Score'));
            } else {
                const rounds = [];
                rounds[index] = parseInt(row.get('Score'));
                scores_map.set(team_name, {
                    total: parseInt(row.get('Score')),
                    rounds,
                });
            }
        });
        return scores_map;
    }, new Map());

    // Attempt the next page if this page had results
    const next_page_scores_map = table_objects.length ? await getScores(page + 1) : new Map();

    // Add the scores from the next page to the current page
    next_page_scores_map.forEach((value, key, map) => {
        if (scores.has(key)) {
            const team_scores = scores.get(key);
            team_scores.total += value.total;
            team_scores.rounds = team_scores.rounds.concat(value.rounds);
        } else {
            scores.set(key, value);
        }
    });

    // Find the highest number of rounds played for any team
    const total_rounds = [...scores.values()].reduce((rounds, value) => {
        if (value.rounds.length > rounds) {
            return value.rounds.length;
        }
        return rounds;
    }, 0);

    // Replace the empty rounds for each team with 0s
    scores.forEach((value, key, map) => {
        for (let i = 0; i < total_rounds; i++) {
            if (!value.rounds[i]) {
                value.rounds[i] = 0;
            }
        }
    });

    return scores;
}

// Turn the scores into an HTML table
function formatScores(scores_object) {
    const scores = [...scores_object.entries()]
        .sort((a, b) => b[1].total - a[1].total) // sort by total score
        .map(([team, results]) => `<tr>
            <td>${team}</td>
            <td class="rounds">${results.rounds.map(r => `<span>${r}</span>`)}</td>
            <td>${results.total}</td>
        </tr>`)
        .join('\n');

    return `<html>
                <head>
                    <meta name="viewport" content="width=device-width,initial-scale=1"/>
                    <style>
                        body {
                            font-family: sans-serif;
                        }

                        table {
                            border-collapse: collapse;
                            margin: auto;
                        }

                        th, td {
                            padding: 10px;
                            text-align: center;
                            border-bottom: 1px solid #ddd;
                        }

                        th:first-child, td:first-child {
                            text-align: left;
                        }

                        td.rounds span {
                            display: inline-block;
                            width: 20px;
                            text-align: center;
                        }
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <th>Team Name</th>
                            <th>Rounds</th>
                            <th>Total</th>
                        </tr>
                        ${scores}
                    </table>
                </body>
            </html>
    `;
}
