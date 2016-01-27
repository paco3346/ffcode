var map;
var eventCollection;
var filterCollection;
var storeTypeCollection;
var filtersApplied = {};
var isMSIE = /*@cc_on!@*/0;

var driveListUrl = 'https://drive.google.com/embeddedfolderview?id=';
var parser = document.createElement('a');
var sheetsUrl = 'https://spreadsheets.google.com/feeds/list/';
var googleSheetId = '1EPzBHuhpMeTMAV6R_xPzyDmYFK1msH16kh0Hx1ZvgMQ';
var eventsSheetIndex = 1;
var filtersSheetIndex = 2;
var typesSheetIndex = 3;

if(window.self != window.top) var socket = new easyXDM.Socket({});

var script = function(){

    var iframe = $('#photoViewer').hide();
    $('body').click(function() {
        iframe.hide();
    }).keyup(function(e) {
       if(e.keyCode == 27) {
           iframe.hide();
       }
    });

    //define primitives

    var statesInUse = [];
    var citiesInUse = [];

    //define all templates
    var eventTemplate = '{{#if featured}}<div class="event-view-featured" title="This is a featured listing"></div>{{/if}}'
        +'<span class="event-view-type">{{type}}</span>'
        +'<div class="event-view-date"><span>{{start}}</span> - <span>{{end}}</span></div>'
        +'<div class="event-view-location"><span>{{city}}</span>, <span>{{state}}</span></div>'
        +'<div class="event-view-expand ui-icon ui-icon-circle-triangle-e"></div>'
        +'<div class="event-view-folder">'
            +'<span class="event-listing-description">{{description}}</span>'
            +'<div class="event-view-right">'
                +'{{#if album}}'
                    +'<span class="event-view-album"><a class="event-view-album-href" href="#">View Album</a></span>'
                    +'<div class="images"></div>'
                +'{{/if}}'
                +'{{#if onlineItem}}'
                    +'<div class="event-view-onlineItem" title="Some items are available on our online store"></div>'
                +'{{/if}}'
            +'</div>'
        +'</div>';


    var filterCollectionTemplate = '<div id="filterButton">View Filter</div>'
        +'<div class="filter-collection-pane">'
            +'<div id="filterMenuButton">Add Filter</div>'
        +'</div>';


    var eventViewTemplate = Handlebars.compile(eventTemplate);
    var filterCollectionViewTemplate = Handlebars.compile(filterCollectionTemplate);



    //define all event objects
    var EventModel = Backbone.Model.extend({
        defaults: {
        }
    });

    var EventCollection = Backbone.Collection.extend({
        model: EventModel
    });

    var EventView = Backbone.View.extend({
        tagName: "div",
        className: "event-view",
        events: {
            'click .event-view-expand' : 'toggleFolder',
            'click .event-view-album-href' : 'openLightbox',
            'mouseover' : 'hoverOver',
            'mouseleave' : 'hoverOut',
            'click' : 'zoomToMarker'
        },
        initialize: function() {
            _(this).bindAll('render', 'toggleFolder', 'openLightbox', 'createMarker', '_createMarker', 'hoverOver',
                'hoverOut', 'applyFilter', 'hide', 'show', '_removeMarker', 'checkMapVisibility', 'zoomToMarker');
            if(statesInUse.indexOf(this.model.get("state")) == -1) statesInUse.push(this.model.get("state"));
            if(citiesInUse.indexOf(this.model.get("city")) == -1) citiesInUse.push(this.model.get("city"));
            this.model.bind("applyFilter2", this.applyFilter);
            this.model.bind('checkMapVisibility', this.checkMapVisibility);
            this.render();
            this.createMarker();
            this._editing = false;
            return this;
        },
        render: function() {
            var storeType = this.model.get("store_type");
            var e;
            e = $(eventViewTemplate({
                type: storeType.get("name"),
                start: $.datepicker.formatDate('mm/dd/yy', this.model.get("start_date")),
                end: $.datepicker.formatDate('mm/dd/yy', this.model.get("end_date")),
                city: this.model.get("city"),
                state: this.model.get("state") ? this.model.get("state").toUpperCase() : "",
                description: this.model.get("description"),
                album: this.model.get("album"),
                featured: this.model.get("featured"),
                onlineItem: this.model.get("hasOnlineItem")
            }));
            $(this.el).html(e);
            /*if (this.model.get("featured")) {
                $(this.el).addClass("event-view-featured");
            }*/
            iframeResize();
        },
        toggleFolder: function(e) {
            var button = $(this.el).children(".event-view-expand");
            var folder = $(this.el).children(".event-view-folder");
            e.stopPropagation();
            $(".event-view-folder").not(".event-view-edit .event-view-folder").slideUp({
                duration: 'fast',
                progress: iframeResize
            });

            $(".event-view-expand").removeClass("event-view-expanded ui-icon-circle-triangle-s");

            if(button.hasClass("event-view-expanded")){
                button.removeClass("event-view-expanded ui-icon-circle-triangle-s");
            }else if(folder.is(":hidden")){
                button.addClass("event-view-expanded ui-icon-circle-triangle-s");
                folder.slideDown({
                    duration: 'fast',
                    progress: iframeResize
                });
            }
        },
        openLightbox: function(e) {
            e.preventDefault();
            e.stopPropagation();
            iframe.attr('src', driveListUrl + this.model.get("album") + '#grid').show();
        },
        createMarker: function() {
            this._removeMarker();
            this._marker = this._createMarker();
        },
        _removeMarker: function() {
            if(this._marker) {
                this._marker.setMap(null);
                delete this._marker;
            }
        },
        _createMarker: function() {
            if(this.model.get("location")){
                var storeType = this.model.get("store_type");
                var icon = null;
                if (this.model.get("featured")) {
                    icon = "images/star_128.png";
                } else if (storeType.get("icon")) {
                    icon = "icons/"+storeType.get("icon");
                }
                var marker = new google.maps.Marker({
                    map: map,
                    position: new google.maps.LatLng(this.model.get("location").lb, this.model.get("location").mb),
                    icon: icon
                });
                var self = this;
                google.maps.event.addListener(marker, 'click', function() {
                    $(".event-view-expand", self.el).click();
                    $("#event-listings").scrollTop($(self.el).position().top-20);
                });
                return marker;
            }
        },
        hoverOver: function() {
            if(this._marker) this._marker.setAnimation(1);
        },
        hoverOut: function() {
            if(this._marker) this._marker.setAnimation(4);
        },
        hide: function() {
            $(this.el).hide();
            this._marker.setMap(null);
        },
        show: function() {
            $(this.el).show();
            this._marker.setMap(map);
        },
        applyFilter: function() {
            var self = this;
            self.show();
            _.each(filtersApplied, function(value, column) {
                switch(column) {
                    case "store_type":
                        var storeType = self.model.get("store_type");
                        if(storeType.id != value) self.hide();
                        break;
                    case "city":
                        if(self.model.get("city") != value) self.hide();
                        break;
                    case "state":
                        if(self.model.get("state") != value) self.hide();
                        break;
                    case "start_date":
                        if(self.model.get("start_date") < new Date(value)) self.hide();
                        break;
                    case "end_date":
                        if(self.model.get("end_date") > new Date(value)) self.hide();
                        break;
                }
            });
            checkAvailableEventsMessage();
        },
        checkMapVisibility: function(){
            var visible = map.getBounds().contains(this._marker.getPosition());
            if(visible || this._editing) {
                $(this.el).show();
                this.applyFilter();
            } else {
                $(this.el).hide();
            }
        },
        zoomToMarker: function() {
            if(this._marker && this._marker.getPosition() && this._marker.getPosition().lat() != 'NaN') {
                map.setCenter(this._marker.getPosition());
                map.setZoom(10);
            }
        }
    });

    var EventCollectionView = Backbone.View.extend({
        tagName: "div",
        className: 'event-collection-view',
        el: $("#event-listings"),
        initialize: function() {
            _(this).bindAll('render', 'renderEvent', 'applyFilter');
            this.collection.bind("fetch", this.render);
            this.collection.bind("applyFilter", this.applyFilter);
        },
        render: function() {
            var self = this;
            this.collection.each(function(eventData) {
                self.renderEvent(eventData, false);
            });
            statesInUse.sort();
            citiesInUse.sort();
            checkAvailableEventsMessage();
        },
        renderEvent: function(eventData) {
            var eventView = new EventView({
                model: eventData
            });
            $(eventView.el).appendTo(this.el);
        },
        applyFilter: function() {
            this.collection.each(function(event) {
                event.trigger("applyFilter2");
            });
        }
    });

    //define all filter objects
    var Filter = Backbone.Model.extend({
        defaults: {
        }
    });

    var FilterCollection = Backbone.Collection.extend({
        model: Filter
    });

    var FilterView = Backbone.View.extend({
        tagName: "div",
        className: "filter-view fancy-input",
        events: {
            'click .remove-filter-icon' : 'removeFilter',
            'change select' : 'applyFilterSelect',
            'change input' : 'applyFilterInput'
        },
        initialize: function() {
            _(this).bindAll('render', 'renderDate', 'generateFilterTitle', 'removeFilter', 'applyFilterSelect', 'applyFilterInput');
            this.render();
            this.column = this.model.get("column");
        },
        render: function() {
            this.model.trigger("inUse");
            var el;
            switch(this.model.get("type")) {
                case "date":
                    el = this.renderDate(this.model.get("column"));
                    break;
                case "string":
                    el = this.renderString(this.model.get("column"));
                    break;
                case "inventory":
                    el = this.renderInventory(this.model.get("column"));
                    break;
            }
            $(this.el).html(el);
            el.before(this.generateFilterTitle()).after(this.generateFilterRemoveIcon());
            if(this.model.get("type") == "string"){
                el.on("chosen:ready", function(){
                    var parent = el.parent();
                    $(".chosen-single", parent).addClass("viewing");
                    $(".chosen-container", parent).addClass("viewing");
                    $(".chosen-drop", parent).addClass("viewing");
                });
                el.chosen(); //can't be called until after it's in the DOM
            }
        },
        renderDate: function() {
            var el = $("<input type='text' />")
                .datepicker()
                .css("width", "8em");
            return el;
        },
        renderString: function(column) {
            var el = $("<select><option></option></select>");
            switch(column) {
                case "store_type":
                    storeTypeCollection.each(function(type){
                        el.append("<option value='"+type.id+"'>"+type.get("name")+"</option>");
                    });
                    break;
                case "state":
                    _.each(statesInUse, function(state){
                        el.append("<option value='"+state+"'>"+state+"</option>");
                    });
                    break;
                case "city":
                    _.each(citiesInUse, function(city){
                        el.append("<option value='"+city+"'>"+city+"</option>");
                    });
                    break;
            }
            return el;
        },
        renderInventory: function() {
            var el =$("<span>Click to View</span>").addClass("filter-inventory");
            return el;
        },
        generateFilterTitle: function() {
            var el = $("<span>"+this.model.get("label")+"</span>")
                .addClass("filter-view-title");
            return el;
        },
        generateFilterRemoveIcon: function() {
            var el = $("<div></div>").addClass("ui-icon ui-icon-circle-close remove-filter-icon");
            return el;
        },
        removeFilter: function() {
            this.model.trigger("notInUse");
            this.remove();
            delete filtersApplied[this.model.get("column")];
            delete this;
            eventCollection.trigger("applyFilter");
        },
        applyFilterSelect: function() {
            filtersApplied[this.model.get("column")] = $("select", this.el).val();
            eventCollection.trigger("applyFilter");
        },
        applyFilterInput: function() {
            filtersApplied[this.model.get("column")] = $("input", this.el).val();
            eventCollection.trigger("applyFilter");
        }
    });

    var FilterCollectionView = Backbone.View.extend({
        tagName: "div",
        className: "filter-collection-view",
        events: {
            'click #filterButton' : 'toggleView',
            'click #filterMenuButton': 'toggleMenu',
            'focusout #filterMenuButton' : 'closeMenu'
        },
        initialize: function() {
            _(this).bindAll('render', 'toggleView', 'toggleMenu', 'closeMenu');
            this.collection.bind("fetch", this.render);
            this.menu = new FilterMenuCollectionView({
                collection: this.collection
            });
        },
        render: function() {
            var el = $(this.el);
            el.append(filterCollectionViewTemplate());
            $('.filter-collection-pane', el).append(this.menu.el);

            $("#filterButton", el)
                .button()
                .removeClass("ui-corner-all")
                .addClass("ui-corner-tr ui-corner-tl");
            $("#filterMenuButton", el).button();

            el.insertAfter($("#map"));
        },
        toggleView: function() {
            $(".filter-collection-pane", this.el).slideToggle({
                duration: 'fast',
                progress: iframeResize
            });
        },
        toggleMenu: function() {
            this.menu.toggleView();
        },
        closeMenu: function() {
            this.menu.closeView();
        }
    });

    var FilterMenuView = Backbone.View.extend({
        tagName: "li",
        events: {
            'click' : 'createFilter'
        },
        initialize: function() {
            _(this).bindAll('render', 'createFilter', 'showMenuOption', 'hideMenuOption');
            this.model.bind("inUse", this.hideMenuOption);
            this.model.bind("notInUse", this.showMenuOption);
            this.render();
            return this.el;
        },
        render: function() {
            $(this.el).html("<a>"+this.model.get("name")+"</a>");
        },
        createFilter: function() {
            var self = this;
            var filter = new FilterView({
                model: self.model
            });
            $("#filterMenuButton").before(filter.el);
            this.model.collection.trigger("closeMenu");
        },
        showMenuOption: function() {
            $(this.el).show();
        },
        hideMenuOption: function() {
            $(this.el).hide();
        }
    });

    var FilterMenuCollectionView = Backbone.View.extend({
        tagName: "ul",
        className: "filter-collection-menu-view",
        initialize: function() {
            _(this).bindAll('render', 'toggleView', 'closeView');
            this.collection.bind("fetch", this.render);
            this.collection.bind("closeMenu", this.closeView);
        },
        render: function() {
            var self = this;
            this.collection.each(function(filter){
                var item =  new FilterMenuView({
                    model: filter
                });
                $(self.el).append(item.el);
            });
            $(this.el).menu();
        },
        toggleView: function() {
            $(this.el).toggle();
        },
        closeView: function() {
            $(this.el).hide();
        }
    });

    // define store types
    var StoreType = Backbone.Model.extend({
        defaults: {
            id: 0,
            name: '',
            icon: ''
        }
    });

    var StoreTypeCollection = Backbone.Collection.extend({
        model: StoreType
    });

    //start bootstrapping
    eventCollection = new EventCollection();
    filterCollection = new FilterCollection();
    storeTypeCollection = new StoreTypeCollection();

    var filterCollectionView = new FilterCollectionView({
        collection: filterCollection
    });
    var eventCollectionView = new EventCollectionView({
        collection: eventCollection
    });

    function getEvents(){
        var eventData = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + eventsSheetIndex + '/public/values?alt=json',  function(data) {
            console.log(data);
            $.each(data.feed.entry, function(index, entry) {
                var type = storeTypeCollection.get(entry.gsx$type.$t);
                if (type == undefined) {
                    type = storeTypeCollection.get(0); //the generic type
                }
                if(entry.gsx$album.$t.length) {
                    parser.href = entry.gsx$album.$t;
                    var params = parser.search.split('&');
                    var album = '';
                    $.each(params, function(index, param) {
                        var paramParts = param.split('=');
                        if (['?id', 'id'].indexOf(paramParts[0]) != -1) {
                            album = paramParts[1];
                        }
                    });
                }
                eventData.push(new EventModel({
                    city: entry.gsx$city.$t,
                    state: entry.gsx$state.$t,
                    end_date: new Date(entry.gsx$enddate.$t),
                    start_date: new Date(entry.gsx$startdate.$t),
                    location: JSON.parse(entry.gsx$location.$t.length ? entry.gsx$location.$t : '{}'),
                    publish_date: new Date(entry.gsx$publishdate.$t),
                    unpublish_date: new Date(entry.gsx$unpublishdate.$t),
                    featured: entry.gsx$featured.$t == "TRUE" ? true : false,
                    store_type: type,
                    album: album
                }));
            });
            eventCollection.add(eventData);
            eventCollection.trigger("fetch");
        });
    }

    function getFilters(){
        var filterData = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + filtersSheetIndex + '/public/values?alt=json',  function(data) {
            $.each(data.feed.entry, function(index, entry) {
                filterData.push(new EventModel({
                    column: entry.gsx$column.$t,
                    name: entry.gsx$name.$t,
                    label: entry.gsx$label.$t,
                    type: entry.gsx$type.$t
                }));
            });
            filterCollection.add(filterData);
            filterCollection.trigger("fetch");
        });
    }

    function getStoreTypes(){
        var storeTypes = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + typesSheetIndex + '/public/values?alt=json',  function(data) {
            $.each(data.feed.entry, function(index, entry) {
                storeTypes.push(new EventModel({
                    id: entry.gsx$name.$t,
                    name: entry.gsx$name.$t,
                    icon: entry.gsx$icon.$t
                }));
            });
            storeTypeCollection.add(storeTypes);
            storeTypeCollection.trigger("fetch");
            getEvents();
        });
    }


    getStoreTypes();
    getFilters();
    iframeResize();
};

function checkAvailableEventsMessage(){
    if($(".event-view", "#events").is(":visible")) $("#event-listing-none").hide();
    else $("#event-listing-none").show();
}

function setupMap(){
    var mapOptions = {
        //center of US
        center: new google.maps.LatLng(39.876019,-95.581055),
        zoom: 3,
        minZoom: 3,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false
    };

    map = new google.maps.Map(document.getElementById("map"), mapOptions);
    google.maps.event.addListener(map, 'center_changed', checkVisibleMarkers);
    google.maps.event.addListener(map, 'zoom_changed', checkVisibleMarkers);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
            console.log(pos.coords.latitude, pos.coords.longitude);
            map.setCenter(new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
            map.setZoom(5);
        });
    }

    script();
}

function checkVisibleMarkers() {
    eventCollection.each(function(event) {
        event.trigger('checkMapVisibility');
    });
    checkAvailableEventsMessage();
}

function iframeResize() {
    if(socket) socket.postMessage($('body').height());
}

function loadJSDependencies(callback) {
    var deps = [
        '{ff}jquery-1.8.3.js',
        '{ff}jquery-ui-1.9.2.custom.min.js',
        '{ff}underscore-min.js',
        '{ff}backbone.js',
        '{ff}handlebars.js',
        '{ff}chosen.jquery.min.js'
    ];

    var path = 'https://fixturefinders.parseapp.com/';

    scriptsLoaded = 0;

    var scriptLoaded = function(){
        scriptsLoaded++;
        if(deps[scriptsLoaded]) loadScript(deps[scriptsLoaded]);
        else callback();
    };

    var loadScript = function(script){
        var js = document.createElement("script");

        js.type = "text/javascript";
        js.src = script.replace('{ff}', path);

        document.body.appendChild(js);

        //js.onreadystatechange = scriptLoaded;
        /*js.onreadystatechange = function () {
            console.log(this.readyState);
            if (this.readyState == 'complete' || this.readyState == 'loaded') {
                scriptLoaded();
            }
        };*/
        js.onload = scriptLoaded;
    };

    loadScript(deps[0]);
}

function loadCSS() {
    var path = 'https://fixturefinders.parseapp.com/';

    files = [
        '{ff}ui-darkness/jquery-ui-1.8.22.custom.css',
        '{ff}chosen.css',
        '{ff}style.css'
    ];

    for(var i=0; i<files.length; i++) {
        document.write('<link rel="stylesheet" type="text/css" href="'+files[i].replace("{ff}", path)+'">');
    }
}

/*if(typeof jQuery != 'undefined') $(function(){
    /*if(isMSIE)*/ /*setupMap();
    $('body').css("overflow", "hidden");
});
else {
    loadJSDependencies(setupMap);
    loadCSS();
}*/

$(function() {
    setupMap();
});
