var map;
var eventCollection;
var filterCollection;
var storeTypeCollection;
var inventoryCollection;
var filtersApplied = {};

var driveListUrl = 'https://drive.google.com/embeddedfolderview?id=';
var parser = document.createElement('a');
var sheetsUrl = 'https://spreadsheets.google.com/feeds/list/';
var googleSheetId = '1C6du4tKs4AzzGGHrRsRLuZhHXdS3aOqVAnAkPuPLHnU';

var googleSheetConfig = {
    events: {
        columns: {
            startdate: 'Start Date',
            enddate: 'End Date',
            location: 'Location',
            publishdate: 'Publish Date',
            unpublishdate: 'Unpublish Date',
            state: 'State',
            city: 'City',
            type: 'Project Type',
            album: 'Photos',
            featured: 'featured',
            description: 'Description',
            inventory: 'Inventory Web App'
        },
        sheetIndex: 3,
        rowsToIgnore: 'od6'
    },
    types: {
        columns: {
            name: 'Store Type',
            icon: 'Icon'
        },
        sheetIndex: 'oo5ck8a'
    },
    filters: {
        columns: {
            column: 'column',
            name: 'name',
            order: 'order',
            label: 'label',
            type: 'type'
        },
        sheetIndex: 'oha9w0'
    },
    inventory: {
        columns: {
            id: 'id',
            name: 'item'
        },
        sheetIndex: 'oypc1fq'
    }
};

var script = function(){
    //define primitives
    var statesInUse = [];
    var citiesInUse = [];

    //define all templates
    var eventTemplate = '{{#if featured}}<div class="event-view-featured" title="This is a featured listing"></div>{{/if}}'
        +'<span class="event-view-type">{{type}}</span>'
        +'<div class="event-view-date"><span>{{start}}</span> - <span>{{end}}</span></div>'
        +'<div class="event-view-location"><span>{{city}}</span>, <span>{{state}}</span></div>'
        //+'<div class="event-view-expand ui-icon ui-icon-circle-triangle-e"></div>'
        +'<div class="event-view-folder">'
            +'<span class="event-view-description">{{description}}</span>'
            +'<div class="event-view-right">'
                +'{{#if album}}'
                    +'<span class="event-view-album">View Album</span>'
                +'{{/if}}'
                /*+'{{#if onlineItem}}'
                    +'<div class="event-view-onlineItem" title="Some items are available on our online store"></div>'
                +'{{/if}}'*/
                +'{{#if inventory}}'
                    +'<div class="event-view-inventory">View Inventory</div>'
                +'{{/if}}'
            +'</div>'
        +'</div>';

    var eventInventoryTemplate = '{{#each inventoryItems}}<div class="inventory-view-listing">'
        +'<div class="ui-icon ui-icon-circle-check inventory-view-bullet"></div>{{name}}</div>{{/each}}';

    var filterCollectionTemplate = '<div id="filterButton">View Filter</div>'
        +'<div class="filter-collection-pane">'
            +'<div id="filterMenuButton">Add Filter</div>'
        +'</div>';

    var inventoryFilterTemplate = '{{#each inventoryItems}}<div class="inventory-view-listing">'
        +'<input type="checkbox" value="{{id}}" name="inventoryFilterItem" id="inventory_{{id}}" class="inventory-view-checkbox"/>'
        +'<label for="inventory_{{id}}">{{name}}</label></div>{{/each}}';

    var eventViewTemplate = Handlebars.compile(eventTemplate);
    var eventInventoryViewTemplate = Handlebars.compile(eventInventoryTemplate);
    var filterCollectionViewTemplate = Handlebars.compile(filterCollectionTemplate);
    var inventoryFilterViewTemplate = Handlebars.compile(inventoryFilterTemplate);

    //define all event objects
    var EventModel = Backbone.Model.extend({
        defaults: {
        }
    });

    var EventCollection = Backbone.Collection.extend({
        model: EventModel,
        comparator: function(item) {
            var startDate = item.get("start_date");
            var endDate = item.get("start_date");
            return [
                item.get("featured") ? -1 : 1,
                empty(startDate) ? null : startDate.getTime(),
                empty(endDate) ? null : endDate.getTime()
            ];
        }
    });

    var EventView = Backbone.View.extend({
        tagName: "div",
        className: "event-view",
        events: {
            'click .event-view-expand' : 'toggleFolder',
            'click .event-view-album' : 'openPhotos',
            'click .event-view-inventory' : 'openInventory',
            'mouseover' : 'hoverOver',
            'mouseleave' : 'hoverOut',
            'click' : 'zoomToMarker'
        },
        initialize: function() {
            _(this).bindAll('render', 'toggleFolder', 'openPhotos', 'createMarker', '_createMarker', 'hoverOver',
                'hoverOut', 'applyFilter', 'hide', 'show', '_removeMarker', 'checkMapVisibility', 'zoomToMarker',
                'openInventory', 'containsInventoryFilter');
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
                onlineItem: this.model.get("hasOnlineItem"),
                inventory: this.model.get("inventory").length > 0
            }));
            $(this.el).html(e);
            /*if (this.model.get("featured")) {
                $(this.el).addClass("event-view-featured");
            }*/
        },
        toggleFolder: function(e) {
            var button = $(this.el).children(".event-view-expand");
            var folder = $(this.el).children(".event-view-folder");
            e.stopPropagation();
            $(".event-view-folder").not(".event-view-edit .event-view-folder").slideUp({
                duration: 'fast'
            });

            $(".event-view-expand").removeClass("event-view-expanded ui-icon-circle-triangle-s");

            if(button.hasClass("event-view-expanded")){
                button.removeClass("event-view-expanded ui-icon-circle-triangle-s");
            }else if(folder.is(":hidden")){
                button.addClass("event-view-expanded ui-icon-circle-triangle-s");
                folder.slideDown({
                    duration: 'fast'
                });
            }
        },
        openPhotos: function(e) {
            e.preventDefault();
            e.stopPropagation();
            var url = driveListUrl + this.model.get("album") + '#grid';
            eventCollectionView.openPhotos(url);
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
                    icon: icon,
                    zIndex: this.model.get("featured") ? 100 : 1
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
            $(this.el).fadeOut();
            this._marker.setMap(null);
        },
        show: function() {
            $(this.el).fadeIn();
            this._marker.setMap(map);
        },
        applyFilter: function() {
            var self = this;
            var actionTaken = false;
            _.each(filtersApplied, function(value, column) {
                switch(column) {
                    case "store_type":
                        var storeType = self.model.get("store_type");
                        if(storeType.id != value) {
                            self.hide();
                            actionTaken = true;
                        }
                        break;
                    case "city":
                        if(self.model.get("city") != value) {
                            self.hide();
                            actionTaken = true;
                        }
                        break;
                    case "state":
                        if(self.model.get("state") != value) {
                            self.hide();
                            actionTaken = true;
                        }
                        break;
                    case "start_date":
                        if(self.model.get("start_date") < new Date(value)) {
                            self.hide();
                            actionTaken = true;
                        }
                        break;
                    case "end_date":
                        if(self.model.get("end_date") > new Date(value)) {
                            self.hide();
                            actionTaken = true;
                        }
                        break;
                    case "inventory":
                        if (!self.containsInventoryFilter(value)) {
                            self.hide();
                            actionTaken = true;
                        }
                        break;
                }
            });
            if (!actionTaken) {
                self.show();
            }
            checkAvailableEventsMessage();
        },
        checkMapVisibility: function(){
            var self = this;
            var visible = map.getBounds().contains(this._marker.getPosition());
            if(visible || this._editing) {
                self.applyFilter();
            } else {
                self.hide();
            }
        },
        zoomToMarker: function() {
            if(this._marker && this._marker.getPosition() && this._marker.getPosition().lat() != 'NaN') {
                map.setCenter(this._marker.getPosition());
                map.setZoom(10);
                checkVisibleMarkers();
            }
        },
        openInventory: function(e) {
            e.preventDefault();
            e.stopPropagation();
            eventCollectionView.openInventoryViewer(this.model.get("inventory"));
        },
        containsInventoryFilter: function(filterData) {
            var self = this;
            if (empty(filterData.items) || empty(self.model.get("inventory"))) {
                return false;
            }
            for (var i=0; i<filterData.items.length; i++) {
                var id = filterData.items[i];
                var item = self.model.get("inventory").get(id);
                if (filterData.type == 'any' && !empty(item)) {
                    //for 'any' we only need a single match
                    return true;
                } else if (filterData.type == 'all' && empty(item)) {
                    //for 'all' match any missing item breaks the deal
                    return false;
                }
            }
            //an 'any' match would have returned true by now
            //an 'all' match would have returned false by now
            return filterData.type == 'all';
        }
    });

    var EventCollectionView = Backbone.View.extend({
        tagName: "div",
        className: 'event-collection-view',
        el: $("#event-listings"),
        initialize: function() {
            _(this).bindAll('render', 'renderEvent', 'applyFilter', 'openPhotos', 'closeLightbox',
                'openInventoryViewer', 'setupBodyListener');
            this.collection.bind("fetch", this.render);
            this.collection.bind("applyFilter", this.applyFilter);
            this.lightbox = $('#lightbox').hide();
            this.iframe = $('#photoViewer').hide();
            this.lightboxSpinner = $('#lightboxSpinner').hide();
            this.inventoryViewer = $('#inventoryViewer').hide();
            this.eventsSpinner = $('#eventsSpinner');
            this.setupBodyListener();
        },
        render: function() {
            var self = this;
            this.eventsSpinner.hide();
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
        },
        openPhotos: function(url) {
            this.iframe.attr('src', url).show();
            this.lightboxSpinner.show();
            this.lightbox.fadeIn(200);
        },
        closeLightbox: function() {
            var self = this;
            this.lightbox.fadeOut(200, function() {
                self.inventoryViewer.hide();
                self.iframe.hide();
                self.iframe.attr('src', 'about:blank');
                self.lightboxSpinner.hide();
            });
        },
        openInventoryViewer: function(inventory) {
            this.inventoryViewer.empty().show().append(eventInventoryViewTemplate({inventoryItems: inventory.toJSON()}));
            this.lightbox.fadeIn(200);
        },
        setupBodyListener: function() {
            var self = this;
            this.iframe.load(function () {
                self.lightboxSpinner.hide();
            });
            $('body').click(function(e) {
                //don't close the lightbox if the spinner is clicked
                if (e.target != self.lightboxSpinner[0] && e.target != self.inventoryViewer[0]) {
                    self.closeLightbox();
                }
            }).keyup(function(e) {
                if(e.keyCode == 27) {
                    self.closeLightbox();
                }
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
            'change input' : 'applyFilterInput',
            'click .filter-inventory' : 'openInventoryDialog'
        },
        initialize: function() {
            _(this).bindAll('render', 'renderDate', 'generateFilterTitle', 'removeFilter', 'applyFilterSelect', 'applyFilterInput', 'openInventoryDialog');
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
        },
        openInventoryDialog: function() {
            inventoryCollectionView.open();
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
                duration: 'fast'
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

    //define store types
    var StoreType = Backbone.Model.extend({
        defaults: {
            id: 0,
            name: '',
            icon: ''
        }
    });

    var StoreTypeCollection = Backbone.Collection.extend({
        model: StoreType,
        comparator: function(item) {
            return item.get("name");
        }
    });

    //define all inventory objects
    var InventoryModel = Backbone.Model.extend({
        defaults: {
        }
    });

    var InventoryView = Backbone.View.extend({
        tagName: "div",
        className: "inventory-view",
        events: {
        },
        initialize: function() {
            _(this).bindAll('render');
            this.render();
        },
        render: function() {
        }
    });

    var InventoryCollection = Backbone.Collection.extend({
        model: InventoryModel,
        comparator: function(item) {
            return item.get("name");
        }
    });

    var InventoryCollectionView = Backbone.View.extend({
        tagName: "div",
        className: "inventory-collection-view",
        el: $('#inventoryFilter'),
        initialize: function() {
            _(this).bindAll('render', 'open', 'close', 'applyFilter');
            this.collection.bind("fetch", this.render);
            this.$el.hide();
        },
        render: function() {
            var el = $(this.el);
            var self = this;
            el.dialog({
                autoOpen: false,
                width: '30%',
                modal: true,
                buttons: {
                    'Apply': function() {
                        el.dialog("close");
                        self.applyFilter();
                    }
                }
            });
            el.append(inventoryFilterViewTemplate({inventoryItems: this.collection.toJSON()}));
        },
        open: function() {
            var el = $(this.el);
            el.dialog("open");
        },
        close: function() {
            var el = $(this.el);
            el.dialog("close");
        },
        applyFilter: function() {
            var invFilterType = $('input[name="inventoryFilterType"]:checked').val();
            var filterItems = [];
            _.each($('input[name="inventoryFilterItem"]:checked'), function(el) {
                filterItems.push(el.value);
            });
            filtersApplied["inventory"] = {type: invFilterType, items: filterItems};
            eventCollection.trigger("applyFilter");
        }
    });

    //start bootstrapping
    eventCollection = new EventCollection();
    filterCollection = new FilterCollection();
    storeTypeCollection = new StoreTypeCollection();
    inventoryCollection = new InventoryCollection();

    var filterCollectionView = new FilterCollectionView({
        collection: filterCollection
    });
    var eventCollectionView = new EventCollectionView({
        collection: eventCollection
    });
    var inventoryCollectionView = new InventoryCollectionView({
        collection: inventoryCollection
    });

    function getEvents(){
        var eventData = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + googleSheetConfig.events.sheetIndex + '/public/values?alt=json',  function(data) {
            $.each(data.feed.entry, function(index, entry) {
                if (index < googleSheetConfig.events.rowsToIgnore) {
                    return;
                }
                var type = storeTypeCollection.get(getValueFromSheet(entry, 'events', 'type'));
                var location = getValueFromSheet(entry, 'events', 'location');
                var stateParts = getValueFromSheet(entry, 'events', 'state').split('(');
                try {
                    var state = stateParts[1].substring(0, 2);
                } catch (e) {}
                var startDate = getValueFromSheet(entry, 'events', 'startdate');
                var endDate = getValueFromSheet(entry, 'events', 'enddate');
                if (empty(type)||empty(location)||empty(state)||empty(startDate)||startDate=='?') {
                    return;
                }
                var inventoryIds = parseInventoryItemsString(getValueFromSheet(entry, 'events', 'inventory'));
                var eventInventoryCollection = new InventoryCollection();
                _.each(inventoryIds, function(id) {
                    eventInventoryCollection.add(inventoryCollection.get(id));
                });
                eventInventoryCollection.sort();
                eventData.push(new EventModel({
                    city: getValueFromSheet(entry, 'events', 'city'),
                    state: state,
                    description: getValueFromSheet(entry, 'events', 'description'),
                    end_date: empty(endDate) ? '' : new Date(endDate),
                    start_date: new Date(startDate),
                    location: JSON.parse((location && location.length) ? location : '{}'),
                    publish_date: new Date(getValueFromSheet(entry, 'events', 'publishdate')),
                    unpublish_date: new Date(getValueFromSheet(entry, 'events', 'unpublishdate')),
                    featured: getValueFromSheet(entry, 'events', 'featured') == "TRUE",
                    store_type: type,
                    album: getFolderId(getValueFromSheet(entry, 'events', 'album')),
                    inventory: eventInventoryCollection
                }));
            });
            eventCollection.add(eventData);
            eventCollection.trigger("fetch");
        });
    }

    function getFilters(callback){
        var filterData = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + googleSheetConfig.filters.sheetIndex + '/public/values?alt=json',  function(data) {
            $.each(data.feed.entry, function(index, entry) {
                filterData.push(new EventModel({
                    column: getValueFromSheet(entry, 'filters', 'column'),
                    name: getValueFromSheet(entry, 'filters', 'name'),
                    label: getValueFromSheet(entry, 'filters', 'label'),
                    type: getValueFromSheet(entry, 'filters', 'type')
                }));
            });
            filterCollection.add(filterData);
            filterCollection.trigger("fetch");
            if (typeof(callback) === 'function') {
                callback();
            }
        });
    }

    function getStoreTypes(callback) {
        var storeTypes = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + googleSheetConfig.types.sheetIndex + '/public/values?alt=json',  function(data) {
            $.each(data.feed.entry, function(index, entry) {
                storeTypes.push(new EventModel({
                    id: getValueFromSheet(entry, 'types', 'name'),
                    name: getValueFromSheet(entry, 'types', 'name'),
                    icon: getValueFromSheet(entry, 'types', 'icon')
                }));
            });
            storeTypeCollection.add(storeTypes);
            storeTypeCollection.sort();
            storeTypeCollection.trigger("fetch");
            if (typeof(callback) === 'function') {
                callback();
            }
        });
    }

    function getInventoryItems(callback) {
        var inventoryItems = [];
        $.getJSON(sheetsUrl + googleSheetId + '/' + googleSheetConfig.inventory.sheetIndex + '/public/values?alt=json', function(data) {
            $.each(data.feed.entry, function(index, entry) {
                inventoryItems.push(new InventoryModel({
                    id: getValueFromSheet(entry, 'inventory', 'id'),
                    name: getValueFromSheet(entry, 'inventory', 'name')
                }));
            });
            inventoryCollection.add(inventoryItems);
            inventoryCollection.sort();
            inventoryCollection.trigger("fetch");
            if (typeof(callback) === 'function') {
                callback();
            }
        });
    }

    var numResponses = 0;
    var numExpectedResponses = 3;
    var getEventsCallback = function() {
        numResponses++;
        if (numExpectedResponses == numResponses) {
            getEvents();
        }
    };
    getStoreTypes(getEventsCallback);
    getFilters(getEventsCallback);
    getInventoryItems(getEventsCallback);
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
    google.maps.event.addListener(map, 'idle', checkVisibleMarkers);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
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

function getValueFromSheet(entry, sheet, column) {
    try {
        //convert the sheet name the way google does when creating the json response
        var sheetsColumnName = googleSheetConfig[sheet].columns[column].toLowerCase().replace(/[\s_-]/g, '');
        return entry['gsx$' + sheetsColumnName].$t;
    } catch (e) {
        return null;
    }
}

function empty(val) {
    return (val == undefined || val == '');
}

function getFolderId(val) {
    if (empty(val)) {
        return null;
    }
    var retVal = null;
    parser.href = val;
    var params = parser.search.split('&');
    //first search the id as a GET parameter
    $.each(params, function(index, param) {
        var paramParts = param.split('=');
        if (['?id', 'id'].indexOf(paramParts[0]) != -1) {
            retVal = paramParts[1];
        }
    });
    if (!empty(retVal)) return retVal;
    //otherwise look for it in the format of /folders/{id}
    var urlParts = val.split('/');
    $.each(urlParts, function(index, param) {
        if (param == 'folders') {
            retVal = urlParts[index + 1];
        }
    });
    return retVal;
}

function parseInventoryItemsString(val) {
    if (empty(val)) {
        return[];
    }
    try {
        var vals = val.split(',');
        var ret = [];
        _.each(vals, function(val) {
            if (!isNaN(val)) {
                ret.push(parseInt(val));
            }
        });
        return ret;
    } catch (e) {
        return [];
    }
}

$(function() {
    setupMap();
});
