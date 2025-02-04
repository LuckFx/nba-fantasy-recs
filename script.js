// When the "Get Recommendations" button is clicked…
document.getElementById("getRecommendations").addEventListener("click", async function () {
  // Clear previous results and show a loading indicator.
  document.getElementById("results").innerHTML = "";
  document.getElementById("loading").style.display = "block";

  // Determine which period was selected: "week" or "month"
  const period = document.querySelector('input[name="period"]:checked').value;
  const today = new Date();
  let startDate = new Date();
  if (period === "week") {
    startDate.setDate(today.getDate() - 7);
  } else {
    startDate.setDate(today.getDate() - 30);
  }

  // Format the dates as YYYY-MM-DD (required by the API)
  const endDateStr = today.toISOString().split("T")[0];
  const startDateStr = startDate.toISOString().split("T")[0];

  try {
    // Fetch all game stats from the API in the selected date range.
    const allStats = await fetchAllStats(startDateStr, endDateStr);
    // Aggregate stats by player and compute a fantasy score.
    const aggregated = aggregateStats(allStats);
    // For each position (PG, SG, SF, PF, C), pick the best player.
    const bestPicks = getBestByPosition(aggregated);
    // Display the results in the page.
    displayResults(bestPicks);
  } catch (error) {
    console.error(error);
    document.getElementById("results").innerHTML = `<p>Error fetching data: ${error}</p>`;
  }
  
  // Hide loading indicator.
  document.getElementById("loading").style.display = "none";
});

// Fetches all pages of stats from the balldontlie API given a start and end date.
async function fetchAllStats(startDate, endDate) {
  const perPage = 100;
  let page = 1;
  let totalPages = 1;
  let allStats = [];
  const baseUrl = `https://www.balldontlie.io/api/v1/stats?start_date=${startDate}&end_date=${endDate}&per_page=${perPage}`;

  do {
    const response = await fetch(`${baseUrl}&page=${page}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    allStats = allStats.concat(data.data);
    totalPages = data.meta.total_pages;
    page++;
  } while (page <= totalPages);

  return allStats;
}

// Aggregates stats by player (only including players with a defined position)
// and computes a fantasy score per player for the given period.
function aggregateStats(statsArray) {
  const playerAggregates = {};

  statsArray.forEach((stat) => {
    const player = stat.player;
    // Only consider players with a defined (non‑empty) position.
    if (!player.position || player.position.trim() === "") return;

    // Compute fantasy score using a simple formula:
    // fantasy score = points + 1.2×rebounds + 1.5×assists + 3×steals + 3×blocks – turnovers
    const score =
      stat.pts + 1.2 * stat.reb + 1.5 * stat.ast + 3 * stat.stl + 3 * stat.blk - stat.turnover;

    if (playerAggregates[player.id]) {
      playerAggregates[player.id].score += score;
      playerAggregates[player.id].games += 1;
    } else {
      playerAggregates[player.id] = {
        id: player.id,
        name: `${player.first_name} ${player.last_name}`,
        team: stat.team ? stat.team.full_name : "N/A",
        position: player.position,
        score: score,
        games: 1,
      };
    }
  });

  return playerAggregates;
}

// Returns the best player (highest fantasy score) for each position among PG, SG, SF, PF, C.
function getBestByPosition(aggregatedStats) {
  const positions = ["PG", "SG", "SF", "PF", "C"];
  const bestByPosition = {};
  positions.forEach((pos) => {
    bestByPosition[pos] = null;
  });

  Object.values(aggregatedStats).forEach((player) => {
    // Only consider players whose position exactly matches one of our desired positions.
    if (positions.includes(player.position)) {
      if (!bestByPosition[player.position] || player.score > bestByPosition[player.position].score) {
        bestByPosition[player.position] = player;
      }
    }
  });

  return bestByPosition;
}

// Displays the recommended player for each position in the page.
function displayResults(bestPicks) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  for (const pos in bestPicks) {
    const player = bestPicks[pos];
    const playerDiv = document.createElement("div");
    playerDiv.className = "player";
    if (player) {
      playerDiv.innerHTML = `<strong>${pos}:</strong> ${player.name} (${player.team})<br>
                             Total Fantasy Score: ${player.score.toFixed(2)} over ${player.games} game(s)`;
    } else {
      playerDiv.innerHTML = `<strong>${pos}:</strong> No data available.`;
    }
    resultsDiv.appendChild(playerDiv);
  }
}
