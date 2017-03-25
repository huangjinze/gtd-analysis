function loadChoropleth() {

	///////////////////////////////////////////////////////////////////////////
	//////////////////// Set up and initiate svg containers ///////////////////
	///////////////////////////////////////////////////////////////////////////

	// Make svg size scalable
	var svgW = $("#choropleth")
		.width();
	var svgH = 0.7 * svgW;
	var margin = {
			left: 30,
			top: 20,
			right: 30,
			bottom: 50
		},
		width = svgW - margin.left - margin.right,
		height = svgH - margin.top - margin.bottom;

	var svg = d3.select("#choropleth")
		.append("svg")
		.attr("width", svgW)
		.attr("height", svgH)
		.append("g") // New coordinate system (= clipPath)
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Else our map will extend our working area "g" of svg
	svg.append("clipPath")
		.attr("id", "choropleth-area")
		.append("rect")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", width)
		.attr("height", height);

	///////////////////////////////////////////////////////////////////////////
	/////////////////////////////// Load crime data ///////////////////////////
	///////////////////////////////////////////////////////////////////////////

	d3.csv("data/choropleth.csv", function(error, data) {

		var getCategory = function(d) {
			return d.category;
		};
		var getDistrict = function(d) {
			return d.district;
		};
		var getCount = function(d) {
			return d.count;
		};

		// Prepare and group data by category
		grouped_data = {};
		data.forEach(function(d, i) {
			d.count = +getCount(d);
			var group = getCategory(d);
			if (!grouped_data[group]) {
				grouped_data[group] = [];
			}
			grouped_data[group].push({
				district: getDistrict(d),
				count: getCount(d)
			});
		});

		// Set initial data category
		var init_category = 'Prostitution';
		var dataset = grouped_data[init_category];

		var countMax = function() {
			return d3.max(dataset, getCount);
		};
		var countSum = function() {
			return d3.sum(dataset, getCount);
		};

		///////////////////////////////////////////////////////////////////////////
		/////////////////////////////// Load GeoJSON //////////////////////////////
		///////////////////////////////////////////////////////////////////////////

		d3.json("geojson/sfpddistricts.geojson", function(json) {

			function updateProperties() {
				//Merge the data and GeoJSON
				for (var i = 0; i < dataset.length; i++) {
					//Find the corresponding district inside the GeoJSON
					for (var j = 0; j < json.features.length; j++) {
						var jsonDistrict = json.features[j].properties.DISTRICT;
						if (jsonDistrict == getDistrict(dataset[i])) {
							//Copy the data value into the JSON
							json.features[j].properties.count = getCount(dataset[i]);
							break;
						}
					}
				}
			}

			// Wrapper called by update method
			updateProperties();

			///////////////////////////////////////////////////////////////////////////
			/////////////////////////////// Gradient setup ////////////////////////////
			///////////////////////////////////////////////////////////////////////////

			//Needed for gradients
			var defs = svg.append("defs");

			var coloursRainbow = ["#fee0d2", "#fc9272", "#de2d26"];

			//Calculate the gradient
			defs.append("linearGradient")
				.attr("id", "gradient-rainbow-colors")
				.attr("x1", "0%").attr("y1", "0%")
				.attr("x2", "100%").attr("y2", "0%")
				.selectAll("stop")
				.data(coloursRainbow)
				.enter().append("stop")
				.attr("offset", function(d, i) {
					return i / (coloursRainbow.length - 1);
				})
				.attr("stop-color", function(d) {
					return d;
				});

			var colorScaleRainbow = d3.scaleLinear()
				.range(coloursRainbow)
				.interpolate(d3.interpolateHcl);

			var colourRangeRainbow;

			function updateColourRange() {
				colourRangeRainbow = d3.range(0, countMax(), countMax() / (coloursRainbow.length - 1));
				colourRangeRainbow.push(countMax());
				colorScaleRainbow.domain(colourRangeRainbow);
			}

			updateColourRange();

			///////////////////////////////////////////////////////////////////////////
			/////////////////////////////// Draw the legend ///////////////////////////
			///////////////////////////////////////////////////////////////////////////

			var legendWidth = width * 0.6,
				legendHeight = 10;

			//Color Legend container
			var legendsvg = svg.append("g")
				.attr("class", "legendWrapper")
				.attr("transform", "translate(" + width / 2 + "," + height + ")");

			//Draw the Rectangle
			legendsvg.append("rect")
				.attr("class", "legendRect")
				.attr("x", -legendWidth / 2)
				.attr("y", 10)
				.attr("width", legendWidth)
				.attr("height", legendHeight)
				.attr("fill", "url(#gradient-rainbow-colors)");

			//Append title
			legendsvg.append("text")
				.attr("class", "legendTitle")
				.attr("x", 0)
				.attr("y", -2)
				.attr("text-anchor", "middle")
				.text("Number of crimes");

			//Set scale for x-axis
			var xScale = d3.scaleLinear()
				.range([0, legendWidth]);

			//Define x-axis
			var xAxis = d3.axisBottom()
				.ticks(5)
				.scale(xScale);

			// Else numbers will float far to right outside of our working area when updated
			svg.append("clipPath")
				.attr("id", "choropleth-axis-area")
				.append("rect")
				.attr("x", -20)
				.attr("y", -20)
				.attr("width", legendWidth + 20)
				.attr("height", 40);

			//Set up X axis
			var gX = legendsvg.append("g")
				.attr("class", "axis") //Assign "axis" class
				.attr("clip-path", "url(#choropleth-axis-area)")
				.attr("transform", "translate(" + (-legendWidth / 2) + "," + (10 + legendHeight) + ")");

			function updateGradientScale() {
				xScale.domain([0, countMax()]);
				gX.transition()
					.duration(1000)
					.call(xAxis);
			}

			updateGradientScale();

			///////////////////////////////////////////////////////////////////////////
			////////////////////////////// Draw the map ///////////////////////////////
			///////////////////////////////////////////////////////////////////////////

			// 3D space is “projected” onto a 2D plane
			var projection = d3.geoMercator()
				.center([-122.433701, 37.767683])
				.scale(230000) // default scale is 1000 (which is the world level)
				.translate([width / 2, height / 2]); // translate to the center of the SVG

			// Transform features in GeoJSON to SVG paths (creates a function)
			var path = d3.geoPath()
				.projection(projection);

			svg.selectAll("path")
				.data(json.features)
				.enter()
				.append("path")
				.attr("clip-path", "url(#choropleth-area)")
				.attr("d", path)
				.attr("stroke", "white")
				.attr("stroke-width", 2)
				.attr("opacity", 0.7)
				.on("mouseover", function(d) {
					svg.selectAll("path")
						.attr("opacity", 0.3);
					d3.select(this)
						.attr("opacity", 1);
					tip.show({
						district: d.properties.DISTRICT,
						count: d.properties.count,
						sumCount: countSum(),
						fill: colorScaleRainbow(d.properties.count)
					});
				})
				.on("mouseout", function(d) {
					svg.selectAll("path")
						.attr("opacity", 0.7);
					tip.hide({
						district: d.properties.DISTRICT,
						count: d.properties.count,
						sumCount: countSum(),
						fill: colorScaleRainbow(d.properties.count)
					});
				});

			function updateMap() {
				svg.selectAll("path")
					.data(json.features)
					.transition()
					.duration(1000)
					.attr("fill", function(d) {
						// get data value
						var count = d.properties.count;
						if (count) {
							return colorScaleRainbow(count);
						} else {
							return "#ccc";
						}
					});
			}

			updateMap();

			///////////////////////////////////////////////////////////////////////////
			///////////////////////// Set up and call tooltip /////////////////////////
			///////////////////////////////////////////////////////////////////////////

			// Setup tooltip
			// We will define e in mouseover and mouseout functions
			var tip = d3.tip()
				.attr("class", "d3-tip")
				.direction("ne")
				.html(function(e) {
					return "<span style='color:" + d3.color(e.fill).brighter(0.5) + "'>" + e.district + " </span><br><br><span style='color:white'>(" + e.count + " out of " + e.sumCount + ")</span>";
				});
			svg.call(tip);

			///////////////////////////////////////////////////////////////////////////
			////////////////////// Populate and handle dropdown ///////////////////////
			///////////////////////////////////////////////////////////////////////////

			// Handle category selection
			d3.select("#choropleth-menu-button")
				.text(init_category);
			d3.select("#choropleth-dropdown")
				.selectAll("li")
				.data(Object.keys(grouped_data).sort())
				.enter()
				.append("li")
				.append("button")
				.classed("dropdown-item", true)
				.text(function(d) {
					return d;
				})
				.on("click", function(d) {
					dataset = grouped_data[d];

					updateProperties();
					updateColourRange();
					updateGradientScale();
					updateMap();

					d3.select("#choropleth-menu-button")
						.text(d);
				});
		});
	});
}

loadChoropleth();