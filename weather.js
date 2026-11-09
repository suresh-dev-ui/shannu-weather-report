
const cityInput = document.getElementById("cityInput");
const searchForm = document.getElementById("searchForm");
const searchBtn = document.getElementById("searchBtn");
const statusText = document.getElementById("status");
const dashboard = document.getElementById("weatherDashboard");

const weatherTypes = {
    0: ["Clear sky", "☀️"],
    1: ["Mainly clear", "🌤️"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Fog", "🌫️"],
    48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"],
    53: ["Drizzle", "🌦️"],
    55: ["Heavy drizzle", "🌧️"],
    56: ["Freezing drizzle", "🌧️"],
    57: ["Heavy freezing drizzle", "🌧️"],
    61: ["Light rain", "🌦️"],
    63: ["Moderate rain", "🌧️"],
    65: ["Heavy rain", "🌧️"],
    66: ["Freezing rain", "🌧️"],
    67: ["Heavy freezing rain", "🌧️"],
    71: ["Light snow", "🌨️"],
    73: ["Snow", "❄️"],
    75: ["Heavy snow", "❄️"],
    77: ["Snow grains", "🌨️"],
    80: ["Rain showers", "🌦️"],
    81: ["Rain showers", "🌧️"],
    82: ["Heavy rain showers", "⛈️"],
    85: ["Snow showers", "🌨️"],
    86: ["Heavy snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️"],
    99: ["Severe thunderstorm", "⛈️"]
};

function getWeatherInfo(code) {
    return weatherTypes[code] || ["Conditions unavailable", "🌡️"];
}

function showStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error", isError);
}

function displayValue(value, digits = 0) {
    if (value === null || value === undefined ||
        !Number.isFinite(Number(value))) {
        return "--";
    }

    return Number(value).toFixed(digits);
}

function formatHour(time) {
    return new Date(time).toLocaleTimeString("en", {
        hour: "numeric",
        hour12: true
    });
}

function formatDay(date, index) {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";

    return new Date(date + "T12:00:00").toLocaleDateString("en", {
        weekday: "short"
    });
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
}

async function getWeather(city) {
    if (!city.trim()) {
        showStatus("Please enter a city name.", true);
        return;
    }

    searchBtn.disabled = true;
    showStatus("Finding your city and loading weather...");
    dashboard.hidden = true;

    try {
        // 1. Find the city coordinates.
        const geoURL = new URL(
            "https://geocoding-api.open-meteo.com/v1/search"
        );

        geoURL.search = new URLSearchParams({
            name: city.trim(),
            count: "1",
            language: "en",
            format: "json"
        });

        const geoResponse = await fetch(geoURL);

        if (!geoResponse.ok) {
            throw new Error("Could not search for the city.");
        }

        const geoData = await geoResponse.json();

        if (!geoData.results?.length) {
            showStatus("City not found. Try another city name.", true);
            return;
        }

        const place = geoData.results[0];

        // 2. Request current conditions and forecast data.
        const weatherURL = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );

        weatherURL.search = new URLSearchParams({
            latitude: place.latitude,
            longitude: place.longitude,

            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "is_day",
                "precipitation",
                "weather_code",
                "pressure_msl",
                "wind_speed_10m",
                "visibility",
                "uv_index"
            ].join(","),

            hourly: [
                "temperature_2m",
                "weather_code",
                "precipitation_probability"
            ].join(","),

            daily: [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min"
            ].join(","),

            forecast_days: "5",
            forecast_hours: "24",
            timezone: "auto"
        });

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error("Could not load weather data.");
        }

        const data = await weatherResponse.json();

        if (!data.current || !data.hourly || !data.daily) {
            throw new Error("Weather data is incomplete.");
        }

        renderWeather(place, data);
        dashboard.hidden = false;
        showStatus(`Weather updated for ${place.name}.`);
    } catch (error) {
        console.error(error);
        showStatus(
            "Unable to load weather. Check your connection and try again.",
            true
        );
    } finally {
        searchBtn.disabled = false;
    }
}

function renderWeather(place, data) {
    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    const currentInfo = getWeatherInfo(current.weather_code);

    // Find the forecast hour closest to the current time.
    let startIndex = hourly.time.findIndex(
        time => time >= current.time
    );

    if (startIndex < 0) startIndex = 0;

    const rainChance =
        hourly.precipitation_probability?.[startIndex];

    // Location and current conditions.
    setText("locationName", `${place.name}, ${place.country || ""}`);
    setText("cityLabel", place.name);
    setText(
        "countryLabel",
        [place.admin1, place.country].filter(Boolean).join(", ")
    );

    setText("localTime", `Local time: ${current.time.replace("T", " ")}`);
    setText("temperature", displayValue(current.temperature_2m));
    setText("feelsLike", displayValue(current.apparent_temperature));
    setText("condition", currentInfo[0]);
    setText("daylight", current.is_day ? "Daytime" : "Nighttime");
    setText("rainChance", displayValue(rainChance));

    document.getElementById("weatherIcon").textContent =
        currentInfo[1];

    // Weather detail cards.
    setText("humidity", displayValue(current.relative_humidity_2m));
    setText("wind", displayValue(current.wind_speed_10m));
    setText("pressure", displayValue(current.pressure_msl));
    setText(
        "visibility",
        current.visibility == null
            ? "--"
            : displayValue(current.visibility / 1000, 1)
    );
    setText("uvIndex", displayValue(current.uv_index, 1));
    setText("precipitation", displayValue(current.precipitation, 1));

    const uv = Number(current.uv_index);
    let uvText = "UV conditions unavailable";

    if (Number.isFinite(uv)) {
        if (uv < 3) uvText = "Low UV";
        else if (uv < 6) uvText = "Moderate UV";
        else if (uv < 8) uvText = "High UV";
        else if (uv < 11) uvText = "Very high UV";
        else uvText = "Extreme UV";
    }

    setText("uvNote", uvText);

    // Build the next 24 hours.
    const hourlyContainer = document.getElementById("hourlyForecast");
    hourlyContainer.replaceChildren();

    for (
        let i = startIndex;
        i < Math.min(startIndex + 24, hourly.time.length);
        i++
    ) {
        const info = getWeatherInfo(hourly.weather_code[i]);
        const rain = hourly.precipitation_probability?.[i];

        const item = document.createElement("article");
        item.className = "hour-item";

        const time = document.createElement("span");
        time.className = "hour-time";
        time.textContent = i === startIndex
            ? "Now"
            : formatHour(hourly.time[i]);

        const icon = document.createElement("span");
        icon.className = "hour-icon";
        icon.textContent = info[1];
        icon.title = info[0];

        const temp = document.createElement("span");
        temp.className = "hour-temp";
        temp.textContent =
            `${displayValue(hourly.temperature_2m[i])}°`;

        const rainText = document.createElement("span");
        rainText.className = "hour-rain";
        rainText.textContent =
            rain == null ? "-- rain" : `${rain}% rain`;

        item.append(time, icon, temp, rainText);
        hourlyContainer.appendChild(item);
    }

    // Build the five-day forecast.
    const dailyContainer = document.getElementById("dailyForecast");
    dailyContainer.replaceChildren();

    for (let i = 0; i < daily.time.length; i++) {
        const info = getWeatherInfo(daily.weather_code[i]);

        const row = document.createElement("article");
        row.className = "day-item";

        const day = document.createElement("span");
        day.className = "day-name";
        day.textContent = formatDay(daily.time[i], i);

        const condition = document.createElement("span");
        condition.className = "day-condition";

        const icon = document.createElement("span");
        icon.className = "day-icon";
        icon.textContent = info[1];

        const description = document.createElement("span");
        description.textContent = info[0];

        condition.append(icon, description);

        const temps = document.createElement("span");
        temps.className = "day-temps";

        const high = document.createElement("span");
        high.textContent =
            `${displayValue(daily.temperature_2m_max[i])}°`;

        const low = document.createElement("span");
        low.className = "low";
        low.textContent =
            `${displayValue(daily.temperature_2m_min[i])}°`;

        temps.append(high, low);
        row.append(day, condition, temps);
        dailyContainer.appendChild(row);
    }
}

// Search button and Enter key both submit the form.
searchForm.addEventListener("submit", event => {
    event.preventDefault();
    getWeather(cityInput.value);
});

// Load a sample city when the app opens.
getWeather("Hyderabad");
