/* GeoBrowser

Aluno 1: 45679 Diogo Rafael Rebocho Silverio
Aluno 2: 48500 Joao Bernardo Coimbra Marques

Comentario:

Todas as funcionalidades pedidas no enunciado encontram-se implementadas.
Qualquer aspecto menos obvio do codigo tem uma explicacao como comentario.

01234567890123456789012345678901234567890123456789012345678901234567890123456789

HTML DOM documentation: https://www.w3schools.com/js/js_htmldom.asp
Leaflet documentation: http://leafletjs.com/reference-1.0.3.html
Mapbox documentation: https://www.mapbox.com/api-documentation/

INSIDE THIS FILE, YOU CAN CHANGE EVERYTHING YOU WANT!
*/

/* JAVA CLASSES EMULATION */

var JSRoot = {
	SUPER: function(method) {
		return method.apply(this,
			Array.prototype.slice.apply(arguments).slice(1));
	},
	INIT: function() {
		throw "*** MISSING INITIALIZER ***";
	}
};

function NEW(clazz) { // Create an object and applies INIT(...) to it
	function F() {}
	F.prototype = clazz;
	var obj = new F();
	obj.INIT.apply(obj, Array.prototype.slice.apply(arguments).slice(1));
	return obj;
};

function EXTENDS(clazz, added) { // Creates a subclass of a given class
	function F() {}
	F.prototype = clazz;
	var subclazz = new F();
	for(var prop in added)
		subclazz[prop] = added[prop];
	return subclazz;
};

/* GLOBAL CONSTANTS */

const RESOURCES_DIR = "resources/";
const CACHES_FILE = "caches.xml";
const LOAD_PERCENTAGE = 100;  // Should be 100%
const WORLD_CENTRE = [38.661,-9.2044]

/* GLOBAL VARIABLES */

// We use global variables here because this is a small script focused on the
// handling of a single entity, the map. In a larger program with multiple main
// entities, we would have created a class "MapControl" and put inside
// everything related to the map. But beware, cache specific operations should
// not be defined at the global level but instead inside the class "Cache".
var map = null;
var markersGroup = null;
var caches = [];

// Array with the currently visible caches on the map.
var visibleCaches = [];

// Timer responsible for the timelapse operation.
var dateTimer = null;

// Javascript object that holds the state of all the filter options available
// in the control panel.
var filter = {
	archived: false,
	kind: {
		CITO: true,
		Earthcache: true,
		Event: true,
		Letterbox: true,
		Mega: true,
		Multi: true,
		Mystery: true,
		Other: true,
		Traditional: true,
		Virtual: true,
		Webcam: true,
		Wherigo: true
	},
	size: {
		Micro: true,
		Small: true,
		Regular: true,
		Large: true,
		Other: true,
		Unknown: true
	},
	difficulty: {min: 1.0, max: 5.0},
	terrain: {min: 1.0, max: 5.0},
	refDate: null,
};

// Javascript object with all possible cache icons, initialized in the onLoad()
// function. This is reused all the time to improve efficiency.
var icons = {alive: {}, archived: {}};

/* POI CLASS */

// Digital maps for GPS receivers usually include a selection of POI installed
// on the maps. POI means "Point of interest". A POI specifies a name, a
// latitude and a longitude. Each POI can represent, for example, a touristic
// location, a supermarket, a hotel, a police radar, a shopping mall, and so on.
// So, the concept of POI is a very general one.
var POI = EXTENDS(JSRoot, {
	name: "",
	latitude: 0.0,
	longitude: 0.0,
	INIT: function(xml) {
		this.name = getFirstValueByTagName(xml, "name");
		this.latitude = getFirstValueByTagName(xml, "latitude");
		this.longitude = getFirstValueByTagName(xml, "longitude");
	}
});

/* CACHE CLASS */

// A Cache is a specific type of POI. Adds a lot of attributes, all those we
// have available in our database of caches.
var Cache = EXTENDS(POI, {
	code: 0,
	kind: "",
	status: "",
	owner: "",
	altitude: 0,
	size: "",
	difficulty: 0,
	terrain: 0,
	favorites: 0,
	founds: 0,
	not_founds: 0,
	state: "",
	county: "",
	publish: null,
	last_log: null,
	INIT: function(xml) {
		this.SUPER(POI.INIT, xml);
		this.code = getFirstValueByTagName(xml, "code");
		this.kind = getFirstValueByTagName(xml, "kind");
		this.status = getFirstValueByTagName(xml, "status");
		this.owner = getFirstValueByTagName(xml, "owner");
		this.altitude = getFirstValueByTagName(xml, "altitude");
		this.size = getFirstValueByTagName(xml, "size");
		this.difficulty = getFirstValueByTagName(xml, "difficulty");
		this.terrain = getFirstValueByTagName(xml, "terrain");
		this.favorites = getFirstValueByTagName(xml, "favorites");
		this.founds = getFirstValueByTagName(xml, "founds");
		this.not_founds = getFirstValueByTagName(xml, "not_founds");
		this.state = getFirstValueByTagName(xml, "state");
		this.county = getFirstValueByTagName(xml, "county");
		this.publish = stringToDate(getFirstValueByTagName(xml, "publish"));
		this.last_log = stringToDate(getFirstValueByTagName(xml, "last_log"));
	},
	isArchived: function(date) {
		return this.status == "A" && this.last_log.getTime() <= date.getTime();
	},
	isAvailable: function(date) {
		return this.publish.getTime() <= date.getTime() &&
		       (this.status != "A" || this.last_log.getTime() > date.getTime());
	},
	isNeighbour: function(cache) {
		return cache.code != this.code &&
		       haversine(this.latitude, this.longitude,
		                 cache.latitude, cache.longitude) <= 0.5;
	}
});

// Loads the database and converts it to an array of cache objects.
// Uses our XML operations, loadXMLDoc and getAllValuesByTagName.
// The array of caches is global.
function loadCaches(filename)
{
	var xmlDoc = loadXMLDoc(filename);
	var xs = getAllValuesByTagName(xmlDoc, "cache");
	caches = [];
	if(xs.length == 0)
		alert("Empty cache file");
	else {
		caches.length = xs.length * LOAD_PERCENTAGE / 100;
		for(var i = 0 ; i < caches.length ; i++)
			caches[i] = NEW(Cache, xs[i]);
	}
	alert(caches.length + " caches loaded!");
}

/* XML */

// AJAX - cf. end of lecture 21Z
function loadXMLDoc(filename)
{
	var xhttp = new XMLHttpRequest();
	xhttp.open("GET", filename, false);
	try {
		xhttp.send();
	}
	catch(err) {
		alert("Could not access the local geocaching database via AJAX.\n"
			+ "Therefore, no geocaches will be visible.\n\n"
			+ "Please, use the Firefox browser to develop the project!");
	}
	return xhttp.responseXML;
}

// Two simple functions are enough to navigate in the XML document that
// represents the database of caches.
function getAllValuesByTagName(xml, name)  {
	return xml.getElementsByTagName(name);
}

function getFirstValueByTagName(xml, name)  {
	return getAllValuesByTagName(xml, name)[0].childNodes[0].nodeValue;
}

/* MISC */

// Capitalize the first letter of a string.
function capitalize(str)
{
	return str.length > 0
			? str[0].toUpperCase() + str.slice(1)
			: str;
}

// Distance in km between two pairs of coordinates over the earth's surface.
// https://en.wikipedia.org/wiki/Haversine_formula
function haversine(lat1, lon1, lat2, lon2)
{
	function toRad(deg) { return deg * 3.1415926535898 / 180.0; }
	var dLat = toRad(lat2 - lat1), dLon = toRad (lon2 - lon1);
	var sa = Math.sin(dLat / 2.0), so = Math.sin(dLon / 2.0);
	var a = sa * sa + so * so * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
	return 6372.8 * 2.0 * Math.asin (Math.sqrt(a))
}

// Converts a string with the format YYYY/MM/DD to a Date object.
function stringToDate(dateFmt)
{
	var dv = dateFmt.split("/");

	if (dv.length != 3)
		return null;

	var year = parseInt(dv[0]);
	var month = parseInt(dv[1] - 1);
	var day = parseInt(dv[2]);

	return new Date(year, month, day, 0, 0, 0, 0);
}

/* MAP */

// Creates a map. "L" is a global variable that stores the object that
// implements the Leaflet services. "L" is an abbreviation of "Leaflet".
// Our map is stored in a global variable.
function makeMap(center, zoom)
{
	map = L.map("map", {center: center, zoom: zoom});
}

// Creates a layer that will be installed in a map latter. The layer will
// consist in a map of Mapbox, the open source mapping platform. "spec" is a
// string that designates a kind of map, for example: "mapbox.streets",
// "mapbox.satellite", or "mapbox.run-bike-hikes".
function makeLayerMapBox(name, spec)
{
	var urlTemplate =
		  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}"
		+ "?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXV"
		+ "ycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";
	var attr =
		  "Map data &copy; <a href='http://openstreetmap.org'>"
		+ "OpenStreetMap</a> contributors, "
		+ "<a href='http://creativecommons.org/licenses/by-sa/2.0/'>"
		+ "CC-BY-SA</a>, "
		+ "Imagery © <a href='http://mapbox.com'>Mapbox</a>";
	var errorTileUrl =
		"https://upload.wikimedia.org/wikipedia/commons/e/e0/SNice.svg";
	var layer =
		L.tileLayer(urlTemplate, {
				minZoom: 10,
				maxZoom: 18,
				errorTileUrl: errorTileUrl,
				id: spec,
				attribution: attr
		});
	return layer;
}

// "specs" is a list of kind of map designators. All the designators are used to
// create layers, but only the first layer (with index zero) is directly
// installed in the map. All the layers are used to create a "layer control"
// that is installed at the top left of the map and that the user will use to
// select among several map styles that are available. This function also
// creates a "scale control" that shows in the screen the current scale of the
// map.
function addBaseLayers(specs)
{
	var controls = {};
	for(var i in specs){
		const name = specs[i].split('-')[0];
		controls[capitalize(name)] =
			makeLayerMapBox(specs[i], "mapbox/" + specs[i]);
	}
	controls[capitalize(specs[0].split('-')[0])].addTo(map);
	L.control.scale({maxWidth: 150, metric: true, imperial: false})
								.setPosition("topleft").addTo(map);
	L.control.layers(controls, {}).setPosition("topleft").addTo(map);
}

// This exemplifies how to install a click handler on the map.
// When you need to implement something less standard involving the interaction
// with the user, you will need to handle the events yourself.
// One detail: In this code, we avoid creating a new popup for each click.
// To save memory, we create a single popup and reuse it reused again and again.
// We could have stored the popup in a global variable, but we decided to store
// it directly in a extra field in the map, only the show that this alternative
// exists.
function addClickHandler()
{
	if( map.popup === undefined )
		map.popup = L.popup();		// ad-hoc addition of new field to map
	map.on("click",
		function (e) {
			this.popup
				.setLatLng(e.latlng)
				.setContent("You clicked the map at " + e.latlng.toString())
				.openOn(this);
	});
}

// Removes all the markers (geocaches) from the map. Each marker is a layer that
// belongs to the layer group 'markersGroup', all layers belonging to the group
// are removed from it and therefore removed from the map.
function clearMap()
{
	markersGroup.clearLayers();
}

// Populates the map with all the caches contained in the global variable
// 'caches' that are available at the reference date and match the filter
// options in the control panel.
//
// It also updates the statistics section of the control panel.
function populateMap()
{
	visibleCaches = [];

	// Variables that keep track of various statistics related to caches, these
	// will be shown on the statistics section of the control panel.
	var highestCache = null;
	var maxAltitude = -32768;
	var owners = {};
	var top = [
		{name: "", count: 0},
		{name: "", count: 0},
		{name: "", count: 0},
	];

	clearMap();

	for (var i = 0; i < caches.length; i++) {
		var cache = caches[i];

		// The cache is visible if and only if is available at the reference
		// date and it matches all the filters selected by the user.
		if ((cache.isAvailable(filter.refDate) ||
			(filter.archived && cache.isArchived(filter.refDate))) &&
			// Check if kind and size filters match the cache.
            filter.kind[cache.kind] && filter.size[cache.size]     &&
            // Check if the cache difficulty is within range.
			cache.difficulty >= filter.difficulty.min              &&
			cache.difficulty <= filter.difficulty.max              &&
			// Check if the cache terrain is within range.
			cache.terrain >= filter.terrain.min                    &&
			cache.terrain <= filter.terrain.max)
		{
			visibleCaches.push(cache);

			if (cache.altitude > maxAltitude) {
				highestCache = cache;
				maxAltitude = cache.altitude;
			}

			if (cache.owner in owners) {
				owners[cache.owner]++;
			} else {
				owners[cache.owner] = 1;
			}
		}
	}

	// Find out which are the top 3 cache owners.
	for (var name in owners) {
		if (owners[name] > top[0].count) {
			// When inserting a new owner into the top 1 position, the old top 1
			// is the new top 2 and the old top 2 is the new top 3.
			top[2].name = top[1].name;
			top[2].count = top[1].count;
			top[1].name = top[0].name;
			top[1].count = top[0].count;

			top[0].name = name;
			top[0].count = owners[name];
		} else if (owners[name] > top[1].count) {
			// When inserting a new owner into the top 2 position, the old top 2
			// is the new top 3.
			top[2].name = top[1].name;
			top[2].count = top[1].count;

			top[1].name = name;
			top[1].count = owners[name];
		} else if (owners[name] > top[2].count) {
			top[2].name = name;
			top[2].count = owners[name];
		}
	}

	for (var i in visibleCaches) {
		addMarker(visibleCaches[i]);
	}

	// Update the statistics section on the control panel.
	document.getElementById("totalCaches").value = visibleCaches.length;
	document.getElementById("highestCache").value =
		(highestCache != null) ? highestCache.code : "Unknown";
	document.getElementById("top1").value = top[0].name;
	document.getElementById("top2").value = top[1].name;
	document.getElementById("top3").value = top[2].name;
}

// This function is responsible to generate the popup content that appears when
// a user clicks on a cache. The popup content is created only when the user
// actually clicks the cache and not before.
//
// At the end of this function the popup is set and saved, meaning that this
// function is only called once and the same popup is reused until the map is
// repopulated.
function popupFn(marker) {
	var neighbours = 0;
	var cache = marker.cache;

	// Count the number of visible neighbours for the cache associated with the
	// given marker.
	for (var i in visibleCaches) {
		if (cache.isNeighbour(visibleCaches[i])) {
			neighbours++;
		}
	}

	var content = "<b>" + cache.name + "</b> (" + cache.code + ")" + "<br/>" +
	    "<b>Owner: </b>" + cache.owner                             + "<br/>" +
	    "<b>Latitude: </b>" + cache.latitude                       + "<br/>" +
	    "<b>Longitude: </b>" + cache.longitude                     + "<br/>" +
	    "<b>Altitude: </b>" + ((cache.altitude == -32768)
	                           ? "Unknown"
	                           : cache.altitude)                   + "<br/>" +
	    "<b>Size: </b>" + cache.size                               + "<br/>" +
	    "<b>Difficulty: </b>" + cache.difficulty                   + "<br/>" +
	    "<b>Terrain: </b>" + cache.terrain                         + "<br/>" +
	    "<b>Favorites: </b>" + cache.favorites                     + "<br/>" +
	    "<b>Found: </b>" + cache.founds                            + "<br/>" +
	    "<b>Not found: </b>" + cache.not_founds                    + "<br/>" +
	    "<b>Published date: </b>" + cache.publish.toDateString()   + "<br/>" +
	    "<b>Last log: </b>" + cache.last_log.toDateString()        + "<br/>" +
	    "<b>Caches in a 500m radius: </b>" + neighbours            + "<br/>";

	// Set the marker's popup content so that it's reused on future clicks.
	// This saves memory and improves speed.
	marker.setPopupContent(content);

	return content;
}

// Creates a marker corresponding to a given cache and installs the marker on
// the map. Also saves the marker in the global layer group 'markersGroup', so
// that we will be able to erase them in the future (see clearMap()). Marker
// icons are created in the onLoad() function and reused throughout the program
// lifetime.
function addMarker(cache)
{
	var icon = cache.isArchived(filter.refDate)
	         ? icons.archived[cache.kind]
	         : icons.alive[cache.kind];

	var marker = L.marker([cache.latitude, cache.longitude], icon);
	marker.bindPopup(popupFn).bindTooltip(cache.name).addTo(map);

	// Store the cache in an extra field of marker, having the cache associated
	// with a marker is useful for example in the popupFn function.
	marker.cache = cache;

	markersGroup.addLayer(marker);
}

/* INTERACTIVE CONTROL PANEL */

// The following functions are listeners installed in the checkboxes, sliders
// and input text fields available on the control panel. The global variable
// 'filter' is responsible to save their state.
function archivedCheckboxUpdate(checkbox)
{
	filter.archived = checkbox.checked;
	populateMap();
}

function kindCheckboxUpdate(checkbox)
{
	filter.kind[checkbox.id.substring(1)] = checkbox.checked;
	populateMap();
}

function sizeCheckboxUpdate(checkbox)
{
	filter.size[checkbox.id.substring(1)] = checkbox.checked;
	populateMap();
}

function difficultyValue(input)
{
	var min = input.id == "difficultyMin" ? input.value : filter.difficulty.min;
	var max = input.id == "difficultyMax" ? input.value : filter.difficulty.max;

	// On the case of invalid range, reset slider to the old values.
	if (min > max) {
		document.getElementById("difficultyMin").value = filter.difficulty.min;
		document.getElementById("difficultyMax").value = filter.difficulty.max;
	} else {
		filter.difficulty.min = min;
		filter.difficulty.max = max;
	}

	// Update the range display.
	document.getElementById("difficulty").value =
		"[" + filter.difficulty.min + ";" + filter.difficulty.max + "]";
}

function terrainValue(input)
{
	var min = input.id == "terrainMin" ? input.value : filter.terrain.min;
	var max = input.id == "terrainMax" ? input.value : filter.terrain.max;

	// On the case of invalid range, reset slider to the old values.
	if (min > max) {
		document.getElementById("terrainMin").value = filter.terrain.min;
		document.getElementById("terrainMax").value = filter.terrain.max;
	} else {
		filter.terrain.min = min;
		filter.terrain.max = max;
	}

	// Update the range display.
	document.getElementById("terrain").value =
		"[" + filter.terrain.min + ";" + filter.terrain.max + "]";
}

function timeUpdate()
{
	var year = document.getElementById("tYear").value;
	var month = document.getElementById("tMonth").value - 1;
	var day = document.getElementById("tDay").value;

	filter.refDate = new Date(year, month, day, 0, 0, 0, 0);

	// Reinsert the reference date. This corrects the date if the user
	// wrote an invalid date such as 29 of February.
	document.getElementById("tYear").value = filter.refDate.getFullYear();
	document.getElementById("tMonth").value = filter.refDate.getMonth() + 1;
	document.getElementById("tDay").value = filter.refDate.getDate();

	populateMap();
}

function incrementTime()
{
	var currentDate = new Date();

	currentDate.setHours(0);
	currentDate.setMinutes(0);
	currentDate.setSeconds(0);
	currentDate.setMilliseconds(0);

	if (filter.refDate.getTime() < currentDate.getTime()) {
		// Increment reference date by one day.
		filter.refDate.setDate(filter.refDate.getDate() + 1);

		document.getElementById("tYear").value = filter.refDate.getFullYear();
		document.getElementById("tMonth").value = filter.refDate.getMonth() + 1;
		document.getElementById("tDay").value = filter.refDate.getDate();

		populateMap();
	} else {
		clearInterval(dateTimer);
		document.getElementById("timeLapse").checked = false;
	}
}

function timeLapse(checkbox)
{
	if (checkbox.checked)
		dateTimer = setInterval(incrementTime, 500);
	else
		clearInterval(dateTimer);
}

/* ONLOAD */

// An auxiliary object used when creating cache icons. It is reused again and
// again to save memory.
var iconOptions = {
	iconUrl: "??",
	shadowUrl: "??",
	iconSize: [16, 16],   // Size of the icon.
	shadowSize: [16, 16], // Size of the shadow.
	iconAnchor: [8, 8],   // Marker's location.
	shadowAnchor: [8, 8], // The same for the shadow.
	popupAnchor: [0, -6]  // Offset that determines where the popup should open.
};

// What to do when the Web page opens. This is called just after the Web page
// has been loaded and all the DOM elements are available for manipulation.
function onLoad()
{
	var cacheKinds = [
		"CITO", "Earthcache", "Event", "Letterbox", "Mega", "Multi", "Mystery",
		"Other", "Traditional", "Virtual", "Webcam", "Wherigo"
	];
	var cacheSizes = ["Micro", "Small", "Regular", "Large", "Other", "Unknown"];

	// Initialize reference date with the current date and write it on the
	// control panel.
	filter.refDate = new Date();
	filter.refDate.setHours(0);
	filter.refDate.setMinutes(0);
	filter.refDate.setSeconds(0);
	filter.refDate.setMilliseconds(0);
	document.getElementById("tYear").value = filter.refDate.getFullYear();
	document.getElementById("tMonth").value = filter.refDate.getMonth() + 1;
	document.getElementById("tDay").value = filter.refDate.getDate();

	// Initialize the kind section of the 'filter' object and create all
	// possible cache icons.
	for (var i in cacheKinds) {
		var kind = cacheKinds[i];

		document.getElementById("k" + kind).checked = filter.kind[kind];

		iconOptions.iconUrl = RESOURCES_DIR + kind + ".png";
		iconOptions.shadowUrl = RESOURCES_DIR + "Alive.png";
		icons.alive[kind] = {icon: L.icon(iconOptions)};

		iconOptions.shadowUrl = RESOURCES_DIR + "Archived.png";
		icons.archived[kind] = {icon: L.icon(iconOptions)};
	}

	// Initialize the size section of the 'filter' object.
	for (var i in cacheSizes) {
		var size = cacheSizes[i];
		document.getElementById("s" + size).checked = filter.size[size];
	}

	// Archive checkbox.
	document.getElementById("archived").checked = filter.archived;

	// Difficulty and terrain sliders.
	document.getElementById("difficultyMin").value = filter.difficulty.min;
	document.getElementById("difficultyMax").value = filter.difficulty.max;
	document.getElementById("difficulty").value = "[1;5]";

	document.getElementById("terrainMin").value = filter.terrain.min;
	document.getElementById("terrainMax").value = filter.terrain.max;
	document.getElementById("terrain").value = "[1;5]";

	// Reset timelapse checkbox.
	document.getElementById("timeLapse").checked = false;

	makeMap(WORLD_CENTRE, 14);
	addBaseLayers([
		"outdoors-v11", "satellite-streets-v11"
	]);
	addClickHandler();
	loadCaches(RESOURCES_DIR + CACHES_FILE);
	markersGroup = L.layerGroup().addTo(map);
	populateMap();
}
