
function Glorygram(canvas) {
// User defined vars
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d')||null;
// Options vars
	this.config = {};
	this.config.segmentHeightInPercent = 5;
	this.config.verticalSpacingInPercent = 4;
	this.config.horizontalSpacingInPercent = 10;
	this.config.defaultSquareWidthInPercent = 20;
	this.config.connectorDistanceDelta = 20;
	this.config.generalSpacingUnit = 10; // in pixels, used to check busy+to space some elements such as groups
	this.config.connectorLabelMargin = 2;

// Ctx config
	this.ctx.textAlign="center"; 
	this.ctx.textBaseline = "middle";
	this.ctx.lineWidth = 1;
	/*this.ctx.shadowBlur = 2;
	this.ctx.shadowOffsetX = 1;
	this.ctx.shadowOffsetY = 0;*/
// Core vars
	this.segments = [];
	this.elms = {};
	this.connectors = {};
	this.groups = {};
	this.styles = {};
	this.logLastSegments = {};
	this.sizingDelta = 1;

// Methods
	// Generates the initial grid used to position elements within the diagram
	this.generateSegments = function(){
		let segmentHeight = Math.floor(this.canvas.height*(this.config.segmentHeightInPercent*this.sizingDelta/100));
		let verticalSpacing = Math.floor(this.canvas.height*(this.config.verticalSpacingInPercent*this.sizingDelta/100));
		// Spacing at the top
		let remainingSpace = this.canvas.height-verticalSpacing;
		let currentY = verticalSpacing;
		// Add new segment as long as there is room enough
		while(remainingSpace>=segmentHeight){
			this.segments.push({
				minY:currentY,
				maxY:currentY+segmentHeight,
				allocatedSpace: 0, // Does not include spacing
				elementsUid: []
			});
			currentY+=segmentHeight+verticalSpacing;
			remainingSpace-=(segmentHeight+verticalSpacing);
		}
	}

	// Returns the busy width size in pixels in a segment
	this.getAllocatedSpaceWithSpacing = function(segmentId) {
		let horizontalSpacing = Math.floor((this.config.horizontalSpacingInPercent*this.sizingDelta/100)*this.canvas.width);
		return (
			this.segments[segmentId].allocatedSpace // Space used by elements
			+ horizontalSpacing*(this.segments[segmentId].elementsUid.length-1)  // Spacing between elements
		);
	};

	// Adds a new square element to the diagram structure (no rendering)
	this.createElement = function(type, uid, segmentId, text, options) {
		options = options||{};
		width = options.width||Math.floor(this.canvas.width*(this.config.defaultSquareWidthInPercent/100));
		this.elms[uid] = {
			type:type||'square',
			segmentId: segmentId,
			text: text||"",
			style:options.style||null,
			width: width*this.sizingDelta,
			busyPoints: {
				top:0,
				bottom:0,
				left:0,
				right:0																													
			}
		};
		this.connectors[uid] = [];
		this.segments[segmentId].allocatedSpace+=width;
		this.segments[segmentId].elementsUid.push(uid);
	}

	this.createSquareElement = function(uid, segmentId, text, options) {
		this.createElement('square', uid, segmentId, text, options);
	}

	this.createRoundedElement = function(uid, segmentId, text, options) {
		this.createElement('rounded', uid, segmentId, text, options);
	}

	this.createSlightlyRoundedElement = function(uid, segmentId, text, options) {
		this.createElement('slrounded', uid, segmentId, text, options);
	}

	this.create3SquareElement = function(uid, segmentId, text, options) {
		this.createElement('3square', uid, segmentId, text, options);
	}

	this.roundRect = function (x, y, w, h, r) {
		  if (w < 2 * r) r = w / 2;
		  if (h < 2 * r) r = h / 2;
		  this.ctx.beginPath();
		  this.ctx.moveTo(x+r, y);
		  this.ctx.arcTo(x+w, y,   x+w, y+h, r);
		  this.ctx.arcTo(x+w, y+h, x,   y+h, r);
		  this.ctx.arcTo(x,   y+h, x,   y,   r);
		  this.ctx.arcTo(x,   y,   x+w, y,   r);
		  this.ctx.closePath();
		  return this.ctx;
	}

	// Adds a new connector to the diagram structure (no render)
	this.createConnector = function(fromUid, toUid, options) {
		options = options||{};
		type = options.type||'default';
		this.connectors[fromUid].push({
			to: toUid,
			type:type,
			style:options.style||'default',
			text: options.text||'',
			textPosition: options.textPosition|| 'nextTo', // on or nextTo
			fromPoint:options.fromPoint||null,
			toPoint:options.toPoint||null,
			orientation:null
		});
		
	}

	// Adds a new group to the diagram structure
	this.createGroup = function(uid, members, options) {
		options = options||{};
		this.groups[uid] = {
			type:'default',
			members:members||[],
			style: options.style||null
		};
	}

	// Removes a group from the global structure
	this.removeGroup = function(uid) {
		delete this.groups[uid];
	}

	// Returns group coords
	this.determineGroupBoundaries = function(groupUid){
		let x = y = x2 = y2 = null;
		if(!this.groups[groupUid]||!this.groups[groupUid].members.length)return null;
		for(memberUid of this.groups[groupUid].members) {
			let pos = this.getElementCoords(memberUid);
			let minX = pos.x;
			let minY = pos.y;
			let maxX = pos.x+pos.width;
			let maxY = pos.y+pos.height;
			if(x==null||minX<x)x=minX;
			if(y==null||minY<y)y=minY;
			if(x2==null||x2<maxX)x2=maxX;
			if(y2==null||y2<maxY)y2=maxY;
		}
		x-=this.config.generalSpacingUnit;
		y-=this.config.generalSpacingUnit;
		x2+=this.config.generalSpacingUnit;
		y2+=this.config.generalSpacingUnit;
		return {
			x:x,
			y:y,
			height:(y2-y),
			width:(x2-x)
		};
	}

	// Creates new style
	this.createStyle = function(uid, options, inheritFrom){
		inheritFrom = inheritFrom||"default";
		this.styles[uid] = {
			fillColor:options.fillColor||this.styles[inheritFrom].fillColor,
			strokeColor:options.strokeColor||this.styles[inheritFrom].strokeColor,
			textColor:options.textColor||this.styles[inheritFrom].textColor,
			font:options.font||this.styles[inheritFrom].font,
			lineWidth:options.lineWidth||this.styles[inheritFrom].lineWidth,
			arrowheadSize:options.arrowheadSize||this.styles[inheritFrom].arrowheadSize
		}
	}

	this.applyStyle = function(uid, isText){
		if(typeof isText==="undefined")isText=false;
		if(!this.styles[uid])uid="default";
		this.ctx.fillStyle = (isText)?this.styles[uid].textColor:this.styles[uid].fillColor;
		this.ctx.strokeStyle = this.styles[uid].strokeColor;
		this.ctx.font = this.styles[uid].font;
		this.ctx.lineWidth = this.styles[uid].lineWidth;
	}

	this.getStyleProperty = function(uid, prop){
		return this.styles[uid][prop]||this.styles['default'][prop]||null;
	}

	this.adjustColorBrightness = function(hexColor, coeff) {
		var rgb = "#", c, i;
		for (i = 0; i < 3; i++) {
			c = parseInt(hexColor.substr(1+i*2,2), 16); // we get each HEX figure (must be 6 digits) 1+ bc there is a #
			c = Math.round(Math.min(Math.max(0, c + (c*coeff)), 255)).toString(16);
			rgb += ("00"+c).substr(c.length);
		}
		return rgb;
	}

	// Removes an element from a group
	this.removeElementFromGroup = function(groupUid, elementUid) {
		let index = this.groups[groupUid].indexOf(elementUid);
		if(index>-1) this.groups[groupUid].splice(index, 1);
	}

	// Removes an element from the diagram structure
	this.removeElement = function(uid) {
		this.segments[this.elms[uid].segmentId].allocatedSpace-=this.elms[uid].width;
		let index = this.segments[this.elms[uid].segmentId].elementsUid.indexOf(uid);
		if(index>-1) this.segments[this.elms[uid].segmentId].elementsUid.splice(index, 1);
		for(link of this.connectors[uid]) {
			if(this.elms[link.to].busyPoints[link.orientation]) this.elms[link.to].busyPoints[link.orientation]--;
		}
		delete this.connectors[uid];
		delete this.elms[uid];
	}

	// Calculates and returns the X position of an element (this functions automatically centers elements)
	this.getElementXPosition = function(uid) {
		let horizontalSpacing = Math.floor((this.config.horizontalSpacingInPercent*this.sizingDelta/100)*this.canvas.width);
		let leftMargin = 
			(
				this.canvas.width
				- this.getAllocatedSpaceWithSpacing(this.elms[uid].segmentId)
			)/2; // divided by two because we only need the left margin
		let XPosition = leftMargin;
		for(currentUid of this.segments[this.elms[uid].segmentId].elementsUid) {
			if(currentUid==uid) break;
			XPosition+=this.elms[currentUid].width+horizontalSpacing;
		}
		return XPosition;
	}

	this.getPositionInSegment = function(uid) {
		return this.segments[this.elms[uid].segmentId].elementsUid.indexOf(uid);
	}

	// Returns full element coords
	this.getElementCoords = function(uid) {
		return {
			x: this.getElementXPosition(uid),
			y: this.segments[this.elms[uid].segmentId].minY,
			width: this.elms[uid].width,
			height: this.segments[this.elms[uid].segmentId].maxY-this.segments[this.elms[uid].segmentId].minY
		};
	}

	// Returns connector point coords of an element
	// orientation = top/bottom/left/right
	this.getConnectorPointCoords = function(uid, orientation) {
		let base = this.getElementCoords(uid);
		switch(orientation) {

			case "top-1": return {x:base.x, y:base.y}; break;
			case "top-2": return {x:(base.x+base.width/4), y:base.y}; break;
			case "top-3": case "top": return {x:(base.x+base.width/2), y:base.y}; break;
			case "top-4": return {x:(base.x+base.width*0.75), y:base.y}; break;
			case "top-5": return {x:(base.x+base.width), y:base.y}; break;

			case "bottom-1": return {x:base.x, y:(base.y+base.height)}; break;
			case "bottom-2": return {x:(base.x+base.width/4), y:(base.y+base.height)}; break;
			case "bottom-3": case "bottom": return {x:(base.x+base.width/2), y:(base.y+base.height)}; break;
			case "bottom-4": return {x:(base.x+base.width*0.75), y:(base.y+base.height)}; break;
			case "bottom-5": return {x:(base.x+base.width), y:(base.y+base.height)}; break;

			case "left-1": return {x:base.x, y:base.y}; break;
			case "left-2": return {x:base.x, y:(base.y+base.height/4)}; break;
			case "left-3": case "left": return {x:base.x, y:(base.y+base.height/2)}; break;
			case "left-4": return {x:base.x, y:(base.y+base.height*0.75)}; break;
			case "left-5": return {x:base.x, y:(base.y+base.height)}; break;

			case "right-1": return {x:(base.x+base.width), y:base.y}; break;
			case "right-2": return {x:(base.x+base.width), y:(base.y+base.height/4)}; break;
			case "right-3": case "right": return {x:(base.x+base.width), y:(base.y+base.height/2)}; break;
			case "right-4": return {x:(base.x+base.width), y:(base.y+base.height*0.75)}; break;
			case "right-5": return {x:(base.x+base.width), y:(base.y+base.height)}; break;

			default: return null; break;
		}
	}

	// Returns best orientation to create a connector with destination {x:..., y:...}
	this.getBestPointForDestination = function(uid, destinationXY) {
		let base = ["top", "bottom", "left", "right"];
		// 1. removing every busy point
		// Buggy for now, could be useful later
		/*for(or of base) { 
			if(this.elms[uid].busyPoints[or]>0) base.splice(base.indexOf(or), 1);
		}*/
		// 2. removing inner points
		let positionInSegment = this.getPositionInSegment(uid);
		if(positionInSegment!=0) base.splice(base.indexOf("left"), 1);
		if(positionInSegment!=this.segments[this.elms[uid].segmentId].elementsUid.length-1) base.splice(base.indexOf("right"), 1);
		// 3. if more than 1 candidate, pick the closest Y
		if(base.length>1) {
			let currentYDiff = null;
			let currentWinner = null;
			for(or of base) {
				let y = this.getConnectorPointCoords(uid, or).y;
				let diff = null;
				if(y>destinationXY.y) {
					diff = y-destinationXY.y;
				}
				else
				{
					diff = destinationXY.y-y;
				}
				if(currentYDiff==null||currentYDiff>diff) {
					currentYDiff = diff;
					currentWinner = or;
				}
			}
			if(currentWinner!=null) base = [currentWinner];
		}
		if(!base.length)return null;
		
		return base[0];
	}

	// Checks if a line can be rendered (axis = x/y)
	this.isPathBusy = function(Xfrom, Xto, Yfrom, Yto) {
		
		let pathBusy = false;
		if(Yfrom!=Yto && Xfrom==Xto) {
			// Y axis scenario
			for(segmentId in this.segments) {
				// Checking if the segment is crossed
				if( (this.segments[segmentId].minY>Yfrom||this.segments[segmentId].minY>Yto) 
					&& (this.segments[segmentId].maxY<Yfrom||this.segments[segmentId].minY<Yto) ) {
					let segmentBusySpace = this.getAllocatedSpaceWithSpacing(segmentId);
					let minBusyX = (canvas.width-segmentBusySpace)/2;
					let maxBusyX = minBusyX+segmentBusySpace;
					if(Xfrom>=minBusyX && Xfrom<=maxBusyX) {
						pathBusy=true;
						break;
					}
				}
			}
		}
		else if(Yfrom==Yto)
		{
			// X axis scenario
			let step = this.config.generalSpacingUnit*this.sizingDelta;
			if(Xto<Xfrom)step*=-1;
			for(segmentId in this.segments) { // There should be only one
				if( (this.segments[segmentId].minY<Yfrom||this.segments[segmentId].minY<Yto) 
					&& (this.segments[segmentId].maxY>Yfrom||this.segments[segmentId].minY>Yto) ) {
					let segmentBusySpace = this.getAllocatedSpaceWithSpacing(segmentId);
					let minBusyX = (canvas.width-segmentBusySpace)/2;
					let maxBusyX = minBusyX+segmentBusySpace;
					if(step==1) {
						while(Xfrom<=Xto) { 
							if(Xfrom>=minBusyX && Xfrom<=maxBusyX) {
								pathBusy=true;
								break;
							}
							Xfrom+=step;
						}
					}
					else
					{
						while(Xfrom>=Xto) { 
							if(Xfrom>=minBusyX && Xfrom<=maxBusyX) {
								pathBusy=true;
								break;
							}
							Xfrom+=step;
						}
					}
					
				}
			}
		}
		return pathBusy;
	}

	this.adjustConnectorMergingPoint = function(currentPosition, endPoint, log) {
		if(typeof log === "undefined")log=true; // Shall we log the point
		if(this.logLastSegments[Math.round(currentPosition.x)+"x"+Math.round(currentPosition.y)] && this.logLastSegments[Math.round(currentPosition.x)+"x"+Math.round(currentPosition.y)]!=endPoint.x+'x'+endPoint.y) {
			let direction = 1;
			// Vertical arrow scenario
			if(currentPosition.x==endPoint.x) {
				if(endPoint.y<currentPosition.y) direction = -1;
				currentPosition.x+=Math.round(this.config.generalSpacingUnit)*direction;
				endPoint.x +=Math.round(this.config.generalSpacingUnit)*direction;
			}
			// Horizontal arrow scenario
			else
			{
				if(endPoint.x<currentPosition.x) direction = -1;
				currentPosition.y+=Math.round(this.config.generalSpacingUnit)*direction;
				endPoint.y+=Math.round(this.config.generalSpacingUnit)*direction;
			}
		}
		if(log)this.logLastSegments[Math.round(currentPosition.x)+"x"+Math.round(currentPosition.y)] = endPoint.x+'x'+endPoint.y;
	}

	this.adjustMainDelta = function(startPoint, currentPosition) {
		let newStart = Object.assign({},startPoint);
		if(this.logLastSegments[Math.round(currentPosition.x)+"x"+Math.round(currentPosition.y)]) {
			let direction = 1;
			// Vertical arrow scenario
			if(currentPosition.x==startPoint.x) {
				if(currentPosition.y<startPoint.y) direction = -1;
				currentPosition.x+=Math.round(this.config.generalSpacingUnit)*direction;
				newStart.x +=Math.round(this.config.generalSpacingUnit)*direction;
			}
			// Horizontal arrow scenario
			else
			{
				if(currentPosition.x<startPoint.x) direction = -1;
				currentPosition.y+=Math.round(this.config.generalSpacingUnit)*direction;
				newStart.y+=Math.round(this.config.generalSpacingUnit)*direction;
			}
		}
		this.ctx.moveTo(newStart.x, newStart.y);
	}

	this.renderConnectorLabel = function(connector, previousX, previousY, currentPosition, endPoint) {
		this.ctx.textAlign = "right";
		this.applyStyle(((connector.style!=null)?connector.style:"default"), true);
		let txtWidth = this.ctx.measureText(connector.text).width;
		this.applyStyle(((connector.style!=null)?connector.style:"default"));
		if(previousX!=currentPosition.x) {
			let moveTo;
			if(previousX<currentPosition.x) {
				currentPosition.x = previousX+(currentPosition.x-previousX-txtWidth-this.config.connectorLabelMargi*2)/2;
				moveTo = currentPosition.x+txtWidth+this.config.connectorLabelMargi;
				this.ctx.textAlign = "left";
			}
			else if(currentPosition.x<previousX)
			{
				currentPosition.x = currentPosition.x+(previousX-currentPosition.x-txtWidth-this.config.connectorLabelMargi*2)/2;
				moveTo = currentPosition.x-txtWidth-this.config.connectorLabelMargi;

			}
			this.ctx.lineTo(currentPosition.x, currentPosition.y);
			this.applyStyle(((connector.style!=null)?connector.style:"default"), true);
			this.ctx.fillStyle = this.getStyleProperty(connector.style, "strokeColor");
			if(connector.textPosition=='on'){
				this.ctx.fillText(connector.text, currentPosition.x+this.config.connectorLabelMargi, currentPosition.y);
			}
			else
			{
				this.ctx.textAlign = "center";
				this.ctx.fillText(connector.text, currentPosition.x, currentPosition.y-parseInt(this.ctx.font.match(/\d+/), 10)/2);
			}
			this.applyStyle(((connector.style!=null)?connector.style:"default"));
			if(connector.textPosition=='on')this.ctx.moveTo(moveTo, currentPosition.y);
			currentPosition.x = endPoint.x;
		}
		else
		{
			if(connector.textPosition=='on') {
				this.ctx.textAlign = "center";
			}
			else
			{
				//nextTo
				this.ctx.textAlign = "right";
			}
			this.applyStyle(((connector.style!=null)?connector.style:"default"), true);
			var txtHeight = parseInt(this.ctx.font.match(/\d+/), 10);
			this.applyStyle(((connector.style!=null)?connector.style:"default"));
			let moveTo;
			if(previousY<endPoint.y) { 
				currentPosition.y = previousY+(endPoint.y-previousY-txtHeight-this.config.connectorLabelMargi*2)/2;
				moveTo = currentPosition.y+txtHeight/2+this.config.connectorLabelMargi;
			}
			else
			{ 
				currentPosition.y = endPoint.y+(previousY-endPoint.y-txtHeight-this.config.connectorLabelMargi*2)/2;
				moveTo = currentPosition.y-txtHeight/2-this.config.connectorLabelMargi;
			}

			this.ctx.lineTo(currentPosition.x, currentPosition.y);
			this.applyStyle(((connector.style!=null)?connector.style:"default"), true);
			this.ctx.fillStyle = this.getStyleProperty(connector.style, "strokeColor");
			if(connector.textPosition=='on') {
				this.ctx.fillText(connector.text, currentPosition.x, currentPosition.y+this.config.connectorLabelMargi);
			}
			else
			{
				this.ctx.fillText(connector.text, currentPosition.x+txtWidth+this.config.connectorLabelMargi*2, currentPosition.y);
			}
			this.applyStyle(((connector.style!=null)?connector.style:"default"));
			if(connector.textPosition=='on')this.ctx.moveTo(currentPosition.x, moveTo);
			currentPosition.y = endPoint.y;
		}
		this.ctx.textAlign = "center";
	}
 
	// Renders a single connector
	this.renderConnector = function(uid, connectorId) { 
		let connector = this.connectors[uid][connectorId];
		let fromOrientation = null;
		let toOrientation = null;
		let neighbors = false; // The elements which we intent to connect are neighbors
		var labelDrawn = false; // Has the label been drawn yet
		if(connector.text=="")labelDrawn=true; // No label to draw

		// Check if elements are neighbors
		if(this.elms[uid].segmentId==this.elms[connector.to].segmentId) {
			if(this.getPositionInSegment(uid)+1==this.getPositionInSegment(connector.to)) {
				// the element is just before
				fromOrientation = "right";
				toOrientation = "left";
				neighbors = true;
			}
			else if(this.getPositionInSegment(uid)-1==this.getPositionInSegment(connector.to)) {
				// the element is just after
				fromOrientation = "left";
				toOrientation = "right";
				neighbors = true;
			}
		}
		
		if(fromOrientation==null)fromOrientation=this.getBestPointForDestination(uid, this.getElementCoords(connector.to)); // Approximative...
		if(connector.fromPoint!=null)fromOrientation=connector.fromPoint;
		let startPoint = this.getConnectorPointCoords(uid, fromOrientation);
		if(connector.toPoint!=null)toOrientation=connector.toPoint;
		if(toOrientation==null)toOrientation=this.getBestPointForDestination(connector.to, startPoint);
		let endPoint = this.getConnectorPointCoords(connector.to, toOrientation);
		this.elms[uid].busyPoints[fromOrientation]++;
		this.ctx.beginPath();
		this.applyStyle("default");
		if(connector.style!=null)this.applyStyle(connector.style);
		this.ctx.moveTo(startPoint.x, startPoint.y);
		let currentPosition = Object.assign({},startPoint);
		if(!neighbors && connector.type=="default") {
			// Take distance
			switch(fromOrientation.split('-')[0]) {
				case "top": currentPosition.y-=this.config.connectorDistanceDelta*this.sizingDelta;break;
				case "bottom": currentPosition.y+=this.config.connectorDistanceDelta*this.sizingDelta;break;
				case "left": currentPosition.x-=this.config.connectorDistanceDelta*this.sizingDelta;break;
				case "right": currentPosition.x+=this.config.connectorDistanceDelta*this.sizingDelta;break;
			}
			let segmentNum = 1;

			this.adjustMainDelta(startPoint, currentPosition);
			this.ctx.lineTo(currentPosition.x, currentPosition.y);
			// Trace to align X
			
			if(fromOrientation=="bottom"){
				let log = true;
				if(currentPosition.x==endPoint.x)log=false;
				let previousX = currentPosition.x;
				let previousY = currentPosition.y;
				currentPosition.x = endPoint.x;
				this.adjustConnectorMergingPoint(currentPosition, endPoint, log);
				// Label 
				if(connector.text!="" && !labelDrawn) {
					this.renderConnectorLabel(connector, previousX, previousY, currentPosition, endPoint);
					labelDrawn = true;
				}
				this.ctx.lineTo(currentPosition.x, currentPosition.y);
			} 

			// While it is busy to align Y
			// But increase/decrease Y first if needed
			if(currentPosition.y==endPoint.y) {
				while(this.isPathBusy(currentPosition.x, endPoint.x, currentPosition.y, currentPosition.y)) { 
					// Increase or decrease Y until not busy
					currentPosition.y = currentPosition.y+this.config.generalSpacingUnit*this.sizingDelta;
					this.ctx.lineTo(currentPosition.x, currentPosition.y);
					segmentNum++;
				}


				currentPosition.x = endPoint.x;
				this.adjustConnectorMergingPoint(currentPosition, endPoint);
				
				this.ctx.lineTo(currentPosition.x, currentPosition.y);
				segmentNum++;
			} 
			
			let opMadeToAlignX = 1; // Enables us to know if we have to increase or to decrease X until not busy
			if(endPoint.x<startPoint.x)opMadeToAlignX*=-1;
			while(this.isPathBusy(currentPosition.x, currentPosition.x, currentPosition.y, endPoint.y)) { 
				// Increase or decrease X until not busy
				segmentNum++;
				currentPosition.x = currentPosition.x+(this.config.generalSpacingUnit*this.sizingDelta*opMadeToAlignX);
				this.ctx.lineTo(currentPosition.x, currentPosition.y);
			}


			// Trace to align Y if not busy, connect if not busy
			let opMadeToAlignY = 1; // Same usage than opMadeToAlignX but for Y
			if(endPoint.y<startPoint.y) opMadeToAlignY*=-1;
			let previousY = currentPosition.y;
			currentPosition.y = endPoint.y;
			if(!this.isPathBusy(currentPosition.x, endPoint.x, currentPosition.y, currentPosition.y)) {
				let log = true;
				if(segmentNum==1)log=false;
				this.adjustConnectorMergingPoint(currentPosition, endPoint, log);
			}


			
			this.ctx.lineTo(currentPosition.x, currentPosition.y);
			

			
			// While Y busy, increase/decrease until not busy
			while(this.isPathBusy(currentPosition.x, endPoint.x, currentPosition.y, currentPosition.y)) {
				// Increase or decrease Y until not busy
				segmentNum++;
				currentPosition.y = currentPosition.y+(this.config.generalSpacingUnit*this.sizingDelta*opMadeToAlignY);
				this.ctx.lineTo(currentPosition.x, currentPosition.y);
			}



			// Align X again if Y goes beyond destination Y
			if(currentPosition.y!=endPoint.y) {
				currentPosition.x = endPoint.x;
				let log = true;
				if(segmentNum==1)log=false;
				this.adjustConnectorMergingPoint(currentPosition, endPoint, log);	
				this.ctx.lineTo(currentPosition.x, currentPosition.y);
				segmentNum++;
				
			}


			// Visual adapt for left/right corners
			if(toOrientation=="left"||toOrientation=="right") { 
				currentPosition.x = currentPosition.x+(this.config.connectorDistanceDelta*this.sizingDelta*opMadeToAlignX);
				this.ctx.lineTo(currentPosition.x, currentPosition.y);
				this.ctx.lineTo(currentPosition.x, endPoint.y);
				currentPosition.y = endPoint.y;
			}
			
			// Connect
			this.ctx.lineTo(endPoint.x, endPoint.y);
		}
		else if(connector.type=="verticalCurve") {
			this.ctx.bezierCurveTo(currentPosition.x+this.config.generalSpacingUnit, currentPosition.y, currentPosition.x+this.config.generalSpacingUnit, endPoint.y, endPoint.x, endPoint.y);
			if(connector.text!="") {
				let diffX = currentPosition.x-endPoint.x;
				let op = 1;
				if(diffX<0){ diffX*=-1;op=-1; }
				let labelPos = {x: currentPosition.x-diffX/2*op, y:endPoint.y}; // magical, it works
				this.applyStyle(((connector.style!=null)?connector.style:"default"), true);
				this.ctx.fillStyle = this.getStyleProperty(connector.style, "strokeColor");
				this.ctx.fillText(connector.text, labelPos.x, labelPos.y);
				this.applyStyle(((connector.style!=null)?connector.style:"default"));
				labelDrawn = true;
			}
			

		}
		else // neighbors
		{
			this.ctx.lineTo(endPoint.x, endPoint.y);
			if(connector.text!="" && !labelDrawn) {
				let diffX = currentPosition.x-endPoint.x;
				let op = 1;
				if(diffX<0){ diffX*=-1;op=-1; }
				let labelPos = {x: currentPosition.x-diffX/2*op, y:endPoint.y-this.config.generalSpacingUnit*this.sizingDelta};
				this.applyStyle(((connector.style!=null)?connector.style:"default"), true);
				this.ctx.fillStyle = this.getStyleProperty(connector.style, "strokeColor");
				this.ctx.fillText(connector.text, labelPos.x, labelPos.y);
				this.applyStyle(((connector.style!=null)?connector.style:"default"));
				labelDrawn = true;
			}
		}




		// Arrowhead
		let direction = -1; // By default we need to decrease X or Y to place arrowhead points
		let point1 = point2 = {};
		this.ctx.fillStyle = this.ctx.strokeStyle;
		let arrowheadSize = this.styles.default.arrowheadSize;
		if(connector.style!=null) arrowheadSize = this.styles[connector.style].arrowheadSize;		
		// Vertical arrow scenario
		if(currentPosition.x==endPoint.x) {
			if(endPoint.y<currentPosition.y) direction = 1;
			point1 = {x: endPoint.x-arrowheadSize, y:endPoint.y+(arrowheadSize*direction)+direction};
			point2 = {x: endPoint.x+arrowheadSize, y:endPoint.y+(arrowheadSize*direction)+direction};
		}
		// Horizontal arrow scenario
		else
		{
			if(endPoint.x<currentPosition.x) direction = 1;
			point1 = {x:endPoint.x+(arrowheadSize*direction)+direction, y:endPoint.y-arrowheadSize};
			point2 = {x:endPoint.x+(arrowheadSize*direction)+direction, y:endPoint.y+arrowheadSize};
		}
		this.ctx.stroke();
		this.ctx.beginPath();
		this.ctx.lineTo(point1.x, point1.y);
		this.ctx.lineTo(point2.x, point2.y);
		this.ctx.lineTo(endPoint.x, endPoint.y);
		this.ctx.fill();

	}

	this.render = function() {
		// Reset rendering vars
		this.logLastSegments = {};
		// Clear
		this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
		this.ctx.beginPath();
		// Groups rendering
		for(el in this.groups) {
			let coords = this.determineGroupBoundaries(el);
			if(coords!=null) {
				this.applyStyle(((this.groups[el].style!=null)?this.groups[el].style:"group")); 
				this.ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
			}
		}
		// Elements rendering
		for(el in this.elms) {
			let coords = this.getElementCoords(el);
			this.applyStyle(((this.elms[el].style!=null)?this.elms[el].style:"default"));
			switch(this.elms[el].type) {
				case "square":
					this.ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
					this.ctx.strokeRect(coords.x, coords.y, coords.width, coords.height);
				break;
				case "rounded":
					this.roundRect(coords.x, coords.y, coords.width, coords.height,20).fill();
					this.roundRect(coords.x, coords.y, coords.width, coords.height,20).stroke();
				break;
				case "slrounded":
					this.roundRect(coords.x, coords.y, coords.width, coords.height,5).fill();
					this.roundRect(coords.x, coords.y, coords.width, coords.height,5).stroke();
				break;
				case "3square":
					let step = coords.width*0.02;
					if(this.ctx.fillStyle==this.ctx.strokeStyle) { 
						colors = [this.adjustColorBrightness(this.ctx.fillStyle,0.4), this.adjustColorBrightness(this.ctx.fillStyle,0.2), this.ctx.fillStyle];
					}
					else
					{
						colors = [this.ctx.fillStyle,this.ctx.fillStyle,this.ctx.fillStyle];
					}
					this.ctx.fillStyle = colors[0];
					this.ctx.fillRect(coords.x, coords.y, coords.width-step*2, coords.height-step*2);
					this.ctx.strokeRect(coords.x, coords.y, coords.width-step*2, coords.height-step*2);
					this.ctx.fillStyle = colors[1];
					this.ctx.fillRect(coords.x+step, coords.y+step, coords.width-step*2, coords.height-step*2);
					this.ctx.strokeRect(coords.x+step, coords.y+step, coords.width-step*2, coords.height-step*2);
					this.ctx.fillStyle = colors[2];
					this.ctx.fillRect(coords.x+step*2, coords.y+step*2, coords.width-step*2, coords.height-step*2);
					this.ctx.strokeRect(coords.x+step*2, coords.y+step*2, coords.width-step*2, coords.height-step*2);
				break;
			}
			
			this.applyStyle(((this.elms[el].style!=null)?this.elms[el].style:"default"), true); // TEXT MODE
			this.ctx.fillText(this.elms[el].text,coords.x+(coords.width/2), coords.y+(coords.height/2));
		} 
		// Connectors rendering
		for(el in this.connectors){

			for(connId in this.connectors[el]) this.renderConnector(el, connId);

		}
		
		// Checking that dimensions are fine
		for(seg in this.segments) {
			if(this.getAllocatedSpaceWithSpacing(seg)>this.canvas.width) {
				this.sizingDelta*=0.92;
				for(el in this.elms) {
					this.elms[el].width*=0.92;//this.sizingDelta;
				}
				for(seg in this.segments) {
					this.segments[seg].allocatedSpace*=0.92;//this.sizingDelta;
				}
				this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
				this.ctx.beginPath();
				this.render(); 
				return;
			}
		}

	}


// Init actions
	this.generateSegments();
	// Default style, applied to every element and connector. Can be overwritten
	this.createStyle("default", {
		font: "10pt sans-serif ",
		strokeColor: "#1098F7",
		fillColor: "#1098F7",
		textColor: "white",
		lineWidth: 1,
		arrowheadSize: 3
	});
	this.createStyle("red", {fillColor:"#CC2936", textColor:"white", strokeColor:"#CC2936"});
	this.createStyle("purple", {fillColor:"#7F0799", textColor:"white", strokeColor:"#7F0799"});
	this.createStyle("orange", {fillColor:"#FA9F42", textColor:"#555", strokeColor:"#FA9F42"});
	this.createStyle("blue", {fillColor:"#1098F7", textColor:"white", strokeColor:"#1098F7"});
	this.createStyle("darkblue", {fillColor:"#033F63", textColor:"white", strokeColor:"#033F63"});
	this.createStyle("green", {fillColor:"#8BE8CB", textColor:"white", strokeColor:"#8BE8CB"});
	this.createStyle("grey", {fillColor:"#EAEBED", textColor:"#555", strokeColor:"#EAEBED"});
	this.createStyle("black", {fillColor:"#071013", textColor:"white", strokeColor:"#071013"});
	
	// Default style for every group
	this.createStyle("group", {}, "grey");
	
}

