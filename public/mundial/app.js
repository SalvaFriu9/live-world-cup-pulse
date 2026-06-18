/* ====================================================
   WORLD CUP 2026 API
==================================================== */

async function getGames() {
  const res = await fetch("https://worldcup26.ir/get/games");
  const data = await res.json();

  return data.map(game => ({
    fixture: {
      id: game.id,
      date: game.date,
      status: {
        short: game.status || "NS",
        elapsed: game.minute || null
      },
      venue: {
        name: game.stadium || "",
        city: game.city || ""
      },
      referee: game.referee || ""
    },

    league: {
      round: game.group || ""
    },

    teams: {
      home: {
        name: game.home_team,
        logo: game.home_flag
      },

      away: {
        name: game.away_team,
        logo: game.away_flag
      }
    },

    goals: {
      home: game.home_score,
      away: game.away_score
    }
  }));
}


/* ====================================================
   TABLA DE POSICIONES
==================================================== */

async function getGroups() {

  const res = await fetch(
    "https://worldcup26.ir/get/groups"
  );

  return await res.json();
}


/* ====================================================
   CARGAR TODO
==================================================== */

async function loadAll() {

  try {

    const [fixtures, standings] = await Promise.all([
      getGames(),
      getGroups()
    ]);

    detectGoalChanges(fixtures);

    state.fixtures = fixtures;
    state.standings = standings;

    state.scorers = [];

    state.usingDemo = false;

    state.lastUpdate = new Date();

    console.log(fixtures);

    render();

  }

  catch(e){

    console.error(e);

    state.fixtures = DEMO.fixtures;

    state.standings = DEMO.standings;

    state.scorers = DEMO.scorers;

    state.usingDemo = true;

    render();

    toast(
      "Error",
      "No se pudieron cargar los datos",
      "error"
    );

  }

}