import http from 'http';

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });

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


async function getScores() {
    // Purpose: Fetches the trivia data from the Geeks Who Drink website and parses it into a JSON object.
    const response = await fetch('https://www.geekswhodrink.com/wp-admin/admin-ajax.php?action=mb_display_venue_events&pag=1&quiz_id=*&venue=2543192132&team=*');
    const text = await response.text();

    // Find tables in the text and turn them into JSON objects.
    const table_text = text.match(/<table.*?>.*?<\/table>/g);
    const table_objects = table_text.map(table => {
        const rows = table.match(/<tr.*?>.*?<\/tr>/g);
        const headers = rows.shift().match(/<th.*?>.*?<\/th>/g).map(header => header.replace(/<.*?>/g, ''));
        const data = rows.map(row => {
            const cells = row.match(/<td.*?>.*?<\/td>/g).map(cell => cell.replace(/<.*?>/g, ''));
            return cells.reduce((obj, cell, index) => {
                obj[headers[index]] = cell;
                return obj;
            }, {});
        });
        return data;
    }
    );

    // Add the scores together from each table for each team.
    const scores = table_objects.reduce((obj, table) => {
        table.forEach(row => {
            if (obj[row['Team Name']]) {
                obj[row['Team Name']] += parseInt(row.Score);
            } else {
                obj[row['Team Name']] = parseInt(row.Score);
            }
        });
        return obj;
    }, {});

    // Sort the scores from highest to lowest.
    const sorted_scores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    // Turn it back into an object.
    const sorted_scores_object = sorted_scores.reduce((obj, score) => {
        obj[score[0]] = score[1];
        return obj;
    }, {});

    return sorted_scores_object;
}

// Turn the scores into an HTML table
function formatScores(scores_object) {
    const styles = `
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
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
    </style>
    `;

    const scores = Object.entries(scores_object).map(score => `<tr><td>${score[0]}</td><td>${score[1]}</td></tr>`).join('');
    return `${styles}<table><tr><th>Team Name</th><th>Score</th></tr>${scores}</table>`;
}
