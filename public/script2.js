$(function(){
	//setupDropbox();

	Parse.initialize("vwH9IEoStu93mS9WiLbdHOzFgHsUvymqMnz8V53X", "eKSFMb2nSrHsR5ot5i1c8EgIuMgpsgp6CPlD7RXp");
	
	var eventsArray = {};
	var eventElements = {};
	var markers = {};
	var filterElements = {};
	var filtersReadyToBePopulated = false;
	var filters = {};
	var eventTypes = {};
	var eventTypesLoaded= false;
	var allInventory = null;
	
	 var mapOptions = {
		center: new google.maps.LatLng(39.876019,-95.581055),
		zoom: 4,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		streetViewControl: false
	};
	
	var map = new google.maps.Map($("#map")[0], mapOptions);
	google.maps.event.addListener(map, 'center_changed', checkVisibleMarkers);
	google.maps.event.addListener(map, 'zoom_changed', checkVisibleMarkers);
	
	var source  = $("#event-listing").html();
	var eventTemplate = Handlebars.compile(source);
	
	var source2  = $("#event-listing-edit").html();
	var eventTemplateEdit = Handlebars.compile(source2);
	
	var source3 = $("#inventory-filter").html();
	var inventoryFilterTemplate = Handlebars.compile(source3);
	
	var Event = Parse.Object.extend("Event");
	var Inventory = Parse.Object.extend("inventory");
	
	var loginDialog = $("<div></div>")
		.append("<span class='error'></span>")
		.append("<input type='text' name='username' placeholder='Username'/>")
		.append("<input type='password' name='password' placeholder='Password'/>")
		.dialog({
			autoOpen: false,
			modal: true,
			resizable: false,
			draggable: false,
			buttons: [
				{
					text: "Login",
					click: function(){
						login($(this));
					}
				}
			]
		});
	$("input[name=password]", loginDialog).keypress(function(e){
	 if(e.which==13) login(loginDialog);
	});
	
	var inventoryFilterType = $("<div></div>")
		.addClass("inventoryFilterButtonset")
		.append("<input type='radio' id='inventoryFilterAll' name='inventoryFilterType' value='all' checked='checked'/>")
		.append("<label for='inventoryFilterAll'>All</label>")
		.append("<input type='radio' id='inventoryFilterAny' name='inventoryFilterType'  value='any'/>")
		.append("<label for='inventoryFilterAny'>Any</label>")
		.buttonset();
		
	var inventoryFilterDialog = $("<div></div>")
		.append("Still loading filters")
		.dialog({
			autoOpen: false,
			modal: false,
			resizable: false,
			draggable: false,
			minWidth: 820,
			buttons: [
				{
					text: 'OK',
					click: function(){
						$(this).dialog("close");
						applyFilters();
					}
				}
			]
		});
	
	$(".ui-dialog-title", inventoryFilterDialog.prev())
		.append("Show events that have ")
		.append(inventoryFilterType)
		.append(" of the following items");
	
	var loginButton = $("<div>Login</div>").button().click(function(){
		if(Parse.User.current() && Parse.User.current().authenticated()) logout();
		else loginDialog.dialog("open");
	}).appendTo("body");
	
	loadEvents();
	loadFilters();
	loadInventoryItems();
	if(Parse.User.current() && Parse.User.current().authenticated()){
		createAddEventButton();
		$("#event-listings").addClass("admin");
		$("span", loginButton).text("Logout");
	}
	
	var filterButton = $("#filterButton").button().click(function(){
		$("#filters").slideToggle('fast');
	}).removeClass("ui-corner-all").addClass("ui-corner-top");
	
	var token;
	
	/*Parse.Cloud.run("getRequestToken", {}, {
		success: function(results){
			console.log(results);
			window.open(results.authorize_url, '_blank');
			token = results;
		}
	});*/
	
	/*Parse.Cloud.run("getImages", {}, {
		success: function(results){
			console.log(results);
		}
	});*/
	
	$("#token").button().click(function(){
		console.log({token: token.oauth_token, secret: token.oauth_token_secret});
		Parse.Cloud.run("getAccessToken", {token: token.oauth_token, secret: token.oauth_token_secret}, {
			success: function(results){
				console.log(results);
			}
		});
	});
	
	function loadEvents(){
		Parse.Cloud.run("getEvents", {}, {
			success: function(results){
                console.log(results);
				$.each(results.results, function(index, value){
					eventsArray[value.id] = value;
					value.inventory=results.inventory[value.id];
				});
				handleEvents(eventsArray);
			}
		});
	}
	
	function loadFilters(){
		Parse.Cloud.run("getFilters", {}, {
			success: function(results){
				handleFilters(results);
			}
		});
	}
	
	function loadInventoryItems(){
		Parse.Cloud.run("getInventoryItems", {}, {
			success: function(results){
				allInventory = results;
				console.log(results);
				//console.log("----GROUPED ITEMS----");
				$.each(results.btit, function(index, value){
					//console.log(value.type.get("type_name"));
					$.each(value.inventoryItems, function(index2, value2){
						//console.log("	"+value2.get("name"));
					});
				});
				//console.log("----INDIVIDUAL ITEMS----");
				$.each(results.bts, function(index, value){
					//console.log(value.get("name"));
				});
				var columns = columnizeItems(results, 23);
				var e = inventoryFilterTemplate({columns: columns});
				inventoryFilterDialog.html(e);
			},
			error: function(results){
				console.log(results);
			}
		});
	}
	
	function columnizeItems(items, numLines){
		var columns = [];
		colNum=0;
		var count = 0;
		var other = {};
		other.inventoryItems = items.bts;
		other.type = {};
		other.type.attributes = {};
		other.type.attributes.type_name = 'Other';
		items.btit.other = other;
		$.each(items.btit, function(index, value){
			count+=(value.inventoryItems.length+1);
			if(!columns[colNum]) columns[colNum] = [];
			columns[colNum].push(value);
			if(count>numLines){
				colNum++;
				count=0;
			}
		});
		return columns;
	}
	
	function loadEventTypes(callback){
		Parse.Cloud.run("getEventTypes", {}, {
			success: function(results){
				$.each(results, function(index, value){
					eventTypes[value.id] = value;
				});
				if(callback) callback();
			}
		});
	}
	
	function handleEvents(events){
		var eventshtml=$("<div></div>");
		$.each(events, function(index, value){
			addMarkerForEvent(value);
			var e =$(eventTemplate({
				start: $.datepicker.formatDate('mm/dd/yy', value.attributes.start_date),
				end: $.datepicker.formatDate('mm/dd/yy', value.attributes.end_date),
				city: value.attributes.city,
				state: value.attributes.state,
				description: value.attributes.description,
				type: value.attributes.store_type_id.attributes.type_nm,
				album: value.attributes.dropbox_album,
				inventory: value.inventory,
				onlineItem: value.attributes.hasOnlineItem
			})).data("event", value);
			e.mouseenter(function(e){
				mouseenterEvent(value);
			}).mouseleave(function(e){
				mouseleaveEvent(value)
			});
			e.click(function(){
				map.setZoom(7);
				map.panTo(markers[value.id].position);
			});
			$(".editButton", e).button().click(function(event){
				event.stopPropagation();
				if(eventTypesLoaded) editEvent($(e), value);
				else loadEventTypes(function(){
					editEvent($(e), value);
				});
			});
			eventshtml.append(e);
			eventElements[index] = e;
			if(value.attributes.dropbox_album){
				var append = "";
				Parse.Cloud.run("getImages", {url: value.attributes.dropbox_album}, {
					success: function(results){
						$.each(results, function(index2, image){
							append+="<a href='"+image.url+"' class='lightbox' rel='"+index+"'></a>";
						});
						$(".images", e).append(append);
						$(".lightbox", e).lightbox({
							scaleImages: true,
							fitToScreen: true,
							imageClickClose: false
						});
						$('.event-listing-album-href', e).click(function(event){
							event.preventDefault();
							event.stopPropagation();
							$('.lightbox:first', e).click();
						});
					}
				});
			}
		});
		listing = $("#event-listings").html(eventshtml);
		$('.event-listing-expand').click(function(e){
			e.stopPropagation();
			$(".event-listing-folder").not(".event-listing-edit .event-listing-folder").slideUp('fast');
			$(".event-listing-expand").removeClass("event-listing-expanded ui-icon-circle-triangle-s");
			if($(this).hasClass("event-listing-expanded")){
				$(this).removeClass("event-listing-expanded ui-icon-circle-triangle-s");
			}else if($(this).next().is(":hidden")){
				$(this).addClass("event-listing-expanded ui-icon-circle-triangle-s");
				$(this).next(".event-listing-folder").slideDown('fast');
			}
		});
		
		if(filtersReadyToBePopulated) populateFilterData();
		else filtersReadyToBePopulated = true;
		checkAvailableEvents();
	}
	
	function handleFilters(response){
		var filtersElement = $("#filter-listings");
		var filtersMenu = $("<ul></ul>").attr("id", "filters-menu");
		$.each(response, function(index, filter){
			filters[filter.attributes.column]={};
			filters[filter.attributes.column].name=filter.attributes.name;
			filters[filter.attributes.column].values= new Array();
			filtersMenu.append($("<li><a href='#'>"+filter.attributes.name+"</a></li>").data("column", filter.attributes.column));
			
			var isCustom = false;
			
			if(filter.attributes.column=="start_date" || filter.attributes.column=="end_date"){
				var sel = $("<input type='text' />")
					.attr("id", 'filter_'+filter.attributes.column)
					.attr("placeholder", filter.attributes.name)
					.addClass("filter-date chzn-single fancy-input")
					.change(applyFilters)
					.datepicker();
				isCustom = true;
				filtersElement.append(sel);
			} else if (filter.attributes.column=="inventory"){
				var sel = $("<input value='Inventory' readonly='readonly'/>")
					.attr("id", 'filter_'+filter.attributes.column)
					.addClass("filter-inventory chzn-single fancy-input")
					.click(function(){
						inventoryFilterDialog.dialog("open");
					});
				isCustom = true;
				filtersElement.append(sel);
			} else {
				var sel = $("<select data-placeholder='"+filter.attributes.name+"'><option></option></select>")
					.attr("id", 'filter_'+filter.attributes.column)
					.addClass("filter")
					.change(applyFilters);
				filtersElement.append(sel);
				sel.chosen({
					//allow_single_deselect: true
				});
			}
			var icon=$("<div></div>").addClass("ui-icon ui-icon-circle-close remove-filter-icon").click(function(){
				if(filter.attributes.column!="inventory"){
					sel.val("");
					sel.trigger("liszt:updated");
				}
				var selector = "#"+$(sel).attr("id");
				if(!isCustom) selector+="_chzn";
				$(selector).hide();
				$(this).parent().hide();
				checkVisibleMarkers();
				applyFilters();
			});
			var removeButton=$("<div></div>").addClass("remove-filter").append(icon);
			if(isCustom) sel.before(removeButton);
			else sel.after(removeButton);
			removeButton.hide();
			filterElements[filter.attributes.column] = sel;
		});
		$(".filter_date").hide();
		$(".chzn-container").hide();
		filtersMenu.menu();
		filtersMenu.children().click(function(e){
			e.preventDefault();
			filtersMenu.hide();
			var column = $(this).data("column");
			if(column == "start_date" || column=="end_date" || column=='inventory') var selector = "#filter_"+column;
			else var selector = "#filter_"+column+"_chzn";
			$(selector).show().prev(".remove-filter").show();
		});
		filtersElement.after(filtersMenu);
		addFilterButton = $("<div>Add Filter</div>").button().click(function(){
			filtersMenu.toggle();
		}).attr("id", "filter-add");
		filtersElement.append(addFilterButton);
		if(filtersReadyToBePopulated) populateFilterData();
		else filtersReadyToBePopulated = true;
	}
	
	function populateFilterData(){
		$.each(eventElements, function(index, value){
			$.each(value.data("event").attributes, function(column, attr){
				if(attr instanceof Date) attr = $.datepicker.formatDate('mm/dd/yy', attr);
				if(attr.id) attr = attr.attributes.type_nm;
				if(filters[column] && filters[column].values.indexOf(attr)==-1)
					filters[column].values.push(attr);
			});
		});
		
		$.each(filters, function(index, value){
			if(value.name!='Inventory'){
				var sel = "<option></option>";
				$.each(value.values, function(index2, value2){
					sel+="<option value='"+escape(value2)+"'>"+value2+"</option>";
				});
				$("#filter_"+index).empty().append(sel).trigger("liszt:updated");
			}
		});
	}
	
	function applyFilters(){
		needsToHide = {};
		$.each(eventElements, function(id, el){
			needsToHide[id] = false;
		});
		$.each(filterElements, function(column, attr){
			var attrID = attr.attr("id");
			var chosenElement = $("#"+attrID+"_chzn");
			if(chosenElement.is(":visible") || attr.is(":visible")){
			$.each(eventElements, function(id, el){
				val = el.data("event").attributes[column];
				if(val instanceof Date && attr.val()){
					val = $.datepicker.formatDate('mm/dd/yy', val);
					date1Str=unescape(attr.val());
					date2Str=val;
					date1Com = date1Str.split("/");
					date2Com = date2Str.split("/");
					date1 = new Date(date1Com[2], date1Com[0], date1Com[1]).getTime();
					date2 = new Date(date2Com[2], date2Com[0], date2Com[1]).getTime();
					if(column=="start_date"){
						if(date1> date2) needsToHide[id] = true;
					}else if(column=="end_date"){
						if(date1< date2) needsToHide[id] = true;
					}
				} else if (column=='inventory'){
					var type = $("[name=inventoryFilterType]:checked").val();
					var anyMatchFound = false;
					$.each($("input:checked", inventoryFilterDialog), function(index, checkbox){
						if(eventsArray[el.data("event").id].inventory.length==0){ //hide any events that have no inventory
							needsToHide[id] = true;
						}
						if(needsToHide[id] || anyMatchFound){
							return false; //no reason to check the rest of them
						}
						var matchFound=false;
						$.each(eventsArray[el.data("event").id].inventory, function(index2, invItem){ //every inv item attached to an event
							$.each(invItem.inventoryItems, function(index3, item){
								if(item.id == $(checkbox).attr('id')){
									matchFound=true;
									if(type=='any'){
										anyMatchFound = true;
										return false;
									}
								}
							});
						});
						if(!matchFound && type=='all')  needsToHide[id]=true;
					});
					if(!anyMatchFound && type=='any') needsToHide[id]=true;
				} else {
					if(val.id) val = val.attributes.type_nm;
					if(val!=unescape(attr.val()) && attr.val()) needsToHide[id] = true;
				}
			});
			}
		});
		
		$.each(needsToHide, function(id, hide){
			if(hide){
				eventElements[id].hide();
			}
			else if(eventElements[id].data("visibleOnMap")){
				eventElements[id].show();
			}
		});
		checkAvailableEvents();
	}
	
	function getGeocodeForEvent(e, cb){
		var geocoder = new google.maps.Geocoder();
		geocoder.geocode({address: e.attributes.city+", "+e.attributes.state}, function(results, status){
			if(status=='OK') cb(results[0].geometry.location);
			else cb(null);
		});
	}
	
	function addMarkerForEvent(e){
		if(e.attributes.location){
			var marker = new google.maps.Marker({
				map: map,
				position: new google.maps.LatLng(e.attributes.location.jb, e.attributes.location.kb),
				icon: e.attributes.store_type_id.attributes.icon ? ("http://fixturefinders.parseapp.com/icons/"+e.attributes.store_type_id.attributes.icon) : null
			});
			markers[e.id] = marker;
			google.maps.event.addListener(marker, 'click', function() {
				$(".event-listing-expand", eventElements[e.id]).click();
			});
		}
	}
	
	function mouseenterEvent(eventValue){
		if(markers[eventValue.id]) markers[eventValue.id].setAnimation(1);
	}
	
	function mouseleaveEvent(eventValue){
		if(markers[eventValue.id]) markers[eventValue.id].setAnimation(4);
	}
	
	function checkVisibleMarkers(){
		$.each(markers, function(id, marker){
			if((!map.getBounds().contains(marker.getPosition()) && !eventElements[id].hasClass("event-listing-edit")) || eventElements[id].hasClass("edit-hide")){
				eventElements[id].hide();
				eventElements[id].data("visibleOnMap", false);
			}
			else{
				eventElements[id].show();
				eventElements[id].data("visibleOnMap", true);
			}
		});
		checkAvailableEvents();
		applyFilters();
	}
	
	function checkAvailableEvents(){
		if($(".event-listing:visible").length == 0)  $("#event-listing-none").show();
		else $("#event-listing-none").hide();
	}
	
	function createNewEventForm(value){
		if($(".event-listing-new").length!=0) return;
		
		var e =$(eventTemplateEdit({
			start: "",
			end: "",
			city: "",
			state: "",
			description: "",
			type: "",
			album: "",
			inventory:null,
			onlineItem: "<input type='text' />",
		}));
		
		$("[name='start_date']", e).datepicker();
		$("[name='end_date']", e).datepicker();
		
		$("[name='publish_date']", e).datepicker();
		$("[name='unpublish_date']", e).datepicker();
		
		$(".saveButton", e).button().click(function(){
			if(value===undefined) createEvent(e);
			else saveEvent(e, value);
		});
		
		$(".cancelButton", e).button().click(function(){
			$(".edit-hide").show().removeClass("edit-hide");
			e.remove();
			delete e;
		});
		
		 $("#event-listings").children().prepend(e);
		 
		 var options='';
		 $.each(eventTypes, function(id, value){
			 options+='<option value="'+id+'">'+value.attributes.type_nm+'</option>';
		 });
		 
		 $("[name='event_type']", e).append(options).chosen();
		 
		 return e;

	}
	
	function saveEvent(element, eventToSave){
		var Event = Parse.Object.extend("Event");
		if(eventToSave===undefined) var eventToSave = new Event();
		
		var Store_Types = Parse.Object.extend("Store_Types");
		var storeType = new Store_Types();
		storeType.id = $("select[name=event_type]", element).val();
		
		eventToSave.set("city", $("input[name=city]", element).val());
		eventToSave.set("state", $("input[name=state]", element).val());
		
		eventToSave.set("start_date", new Date($("input[name=start_date]", element).val()));
		eventToSave.set("end_date", new Date($("input[name=end_date]", element).val()));
		
		eventToSave.set("publish_date", new Date($("input[name=publish_date]", element).val()));
		eventToSave.set("unpublish_date", new Date($("input[name=unpublish_date]", element).val()));
		
		eventToSave.set("store_type_id", storeType);
		
		eventToSave.set("description", $("textarea[name=description]", element).val());
		
		eventToSave.set("dropbox_album", $("input[name=album]", element).val());
		
		if($("input[name=onlineItem]", element).attr("checked")) eventToSave.set("hasOnlineItem", true);
		else eventToSave.set("hasOnlineItem", false);
		
		getGeocodeForEvent(eventToSave, function(location){
			eventToSave.set("location", location);
			eventToSave.save(null, {
				success: function(eventToSave){
					$("#event-listings").empty();
					clearEvents();
					loadEvents();
				},
				error: function(eventToSave, error){
					console.log(error);
				}
			});
		});
	}
	
	function createEvent(element){
		saveEvent(element);
	}
	
	function login(dialog){
		username = $("input[name=username]", dialog).val();
		password = $("input[name=password]", dialog).val();
		Parse.User.logIn(username, password, {
			success: function(user){
				clearEvents();
				loadEvents();
				dialog.dialog("close");
				$("#event-listings").addClass("admin");
				 $(".error", dialog).removeClass('ui-state-error');
				 createAddEventButton();
				 $("span", loginButton).text("Logout");
				 $("input[name=username]", dialog).val('');
				 $("input[name=password]", dialog).val('');
			},
			error: function(user, error){
				if(error.code ==101)  $(".error", dialog).prepend("Invalid Username or Password").addClass('ui-state-error');
				else $(".error", dialog).prepend("Something went wrong").addClass('ui-state-error');
			}
		});
	}
	
	function logout(){
		Parse.User.logOut();
		$("#addEventButton").remove();
		$("span", loginButton).text("Login");
		clearEvents();
		loadEvents();
		$("#event-listings").removeClass("admin");
	}
	
	function editEvent(element, value){
		if($(".event-listing-new").length!=0) return;
		newForm = createNewEventForm(value);
		
		element.hide().addClass("edit-hide");
		element.after(newForm);
		
		$("input[name=start_date]", newForm).val($.datepicker.formatDate('mm/dd/yy', value.attributes.start_date));
		$("input[name=end_date]", newForm).val($.datepicker.formatDate('mm/dd/yy', value.attributes.end_date));
		
		$("input[name=publish_date]", newForm).val($.datepicker.formatDate('mm/dd/yy', value.attributes.publish_date));
		$("input[name=unpublish_date]", newForm).val($.datepicker.formatDate('mm/dd/yy', value.attributes.unpublish_date));
		
		$("input[name=city]", newForm).val(value.attributes.city);
		$("input[name=state]", newForm).val(value.attributes.state);
		
		$("textarea[name=description]", newForm).val(value.attributes.description);
		
		$("input[name=album]", newForm).val(value.attributes.dropbox_album);
		
		if(value.attributes.hasOnlineItem) $("input[name=onlineItem]", newForm).attr("checked", true);
		
		$(".event-listing-inventory-button", newForm).button();
		
		var columns = columnizeItems(allInventory, 23);
		var e = inventoryFilterTemplate({columns: columns});
		var eventInventory = $("<div></div").html(e);
		
		newForm.append(e);
		
		prepInventoryCheckboxesForEvent(value.inventory, newForm, value.id);
		
		var sel = $("select[name=event_type]", newForm);
		sel.val(value.attributes.store_type_id.id).attr("selected", true);
		sel.trigger("liszt:updated");
		
		//inventory: value.inventory.length?value.inventory:null
	}
	
	function prepInventoryCheckboxesForEvent(inventory, e, eventID){
		$.each(inventory, function(index, type){
			$.each(type.inventoryItems, function(index2, value){
				$("#"+value.id, e).attr("checked", true);
			});
		});
		
		$("input[type=checkbox]", e).each(function(index, value){
			$(value).click(function(){
				inventoryCheckboxHelper($(value), eventID);
			});
		});
	}
	
	function inventoryCheckboxHelper(checkbox, eventID){
		var inv = new Inventory();
		inv.set("id", checkbox.attr("id"));
		inv.fetch();
		
		var eve = new Event();
		eve.set("id", eventID);
		eve.fetch();
		
		rel = eve.relation("inventory");
		if(checkbox.attr("checked")) rel.add(inv);
		else rel.remove(inv);
		eve.save();
		
		console.log("Inventory item added to event");
		
	}
	
	function createAddEventButton(){
		var addEventButton = $('<div id="addEventButton">Add Event</div>')
			.button()
			.click(function(){
				if(eventTypesLoaded) createNewEventForm();
				else loadEventTypes(function(){
					createNewEventForm();
				});
			})
			.removeClass("ui-corner-all")
			.addClass("ui-corner-top");
		
		$("#filterButton").after(addEventButton);
	}
	
	function clearEvents(){
		eventsArray = {};
		eventElements = {};
		$.each(markers, function(index, value){
			value.setMap(null);
		});
		markers = {};
	}
});
