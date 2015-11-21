var map;
var eventCollection;
var filterCollection;
var storeTypeCollection;
var filtersApplied = {};
var isMSIE = /*@cc_on!@*/0;

var classToAttr = {
    'event-view-type-edit' : {attr: 'store_type_id', type: 'store_type'},
    'event-view-event-date-edit-start' : {attr: 'start_date', type: 'date'},
    'event-view-event-date-edit-end' : {attr: 'end_date', type: 'date'},
    'event-view-location-edit-state' : {attr: 'state', type: 'text'},
    'event-view-location-edit-city' : {attr: 'city', type: 'text'},
    'event-view-publish-date-edit-start' : {attr: 'publish_date', type: 'date'},
    'event-view-publish-date-edit-end' : {attr: 'unpublish_date', type: 'date'},
    'event-view-description-edit' : {attr: 'description', type: 'text'},
    'event-view-album-edit' : {attr: 'dropbox_album', type: 'text'},
    'event-view-onlineItem-edit' : {attr: 'hasOnlineItem', type: 'bool'}
};

if(window.self != window.top) var socket = new easyXDM.Socket({});

var script = function(){
    Parse.initialize("vwH9IEoStu93mS9WiLbdHOzFgHsUvymqMnz8V53X", "eKSFMb2nSrHsR5ot5i1c8EgIuMgpsgp6CPlD7RXp");

    //define primitives

    var statesInUse = Array();
    var citiesInUse = Array();

    //define all templates
    var eventTemplate = '<span class="event-view-type">{{type}}</span>'
        +'<div class="event-view-date"><span>{{start}}</span> - <span>{{end}}</span></div>'
        +'<div class="event-view-location"><span>{{city}}</span>, <span>{{state}}</span></div>'
        +'<div class="event-view-expand ui-icon ui-icon-circle-triangle-e"></div>'
        +'<div class="event-view-folder">'
            +'<span class="event-listing-description">{{description}}</span>'
            +'<div class="event-view-right">'
                +'{{#if album}}'
                    +'<span class="event-view-album"><a class="event-view-album-href" href="#">View Album</a></span>'
                    +'<div class="event-view-album-loading ui-corner-all"></div>'
                    +'<div class="images"></div>'
                +'{{/if}}'
                +'{{#if onlineItem}}'
                    +'<div class="event-view-onlineItem" title="Some items are available on our online store"></div>'
                +'{{/if}}'
            +'</div>'
        +'</div>';

    var eventEditTemplate = '<select class="event-view-type-edit"></select>'
        +'<div class="event-view-event-date-edit event-view-edit-div-line">'
            +'<label>Start</label>'
            +'<input class="event-view-event-date-edit-start fancy-input date" value="{{start}}"/>'
            +'<label>End</label>'
            +'<input class="event-view-event-date-edit-end fancy-input date" value="{{end}}"/>'
        +'</div>'
        +'<div class="event-view-location-edit event-view-edit-div-line">'
            +'<label>City</label>'
            +'<input class="event-view-location-edit-city fancy-input" value="{{city}}"/>'
            +'<label>State</label>'
            +'<input class="event-view-location-edit-state fancy-input" value="{{state}}"/>'
        +'</div>'
        +'<div class="event-view-publish-date-edit event-view-edit-div-line">'
            +'<label>Publish</label>'
            +'<input class="event-view-publish-date-edit-start fancy-input date" value="{{publish_start}}"/>'
            +'<label>Unpublish</label>'
            +'<input class="event-view-publish-date-edit-end fancy-input date" value="{{publish_end}}"/>'
        +'</div>'
        +'<div class="event-view-edit-description-line">'
            +'<textarea class="event-view-description-edit fancy-input">{{description}}</textarea>'
        +'</div>'
        +'<div class="event-view-right">'
            +'<label>Album</label>'
            +'<input class="event-view-album-edit fancy-input" value="{{album}}"/>'
            +'</br>'
            +'<label>Has Online Item</label>'
            +'<input class="event-view-onlineItem-edit" type="checkbox" {{#if onlineItem}}checked="checked"{{/if}} />'
        +'</div>'
        +'<div class="event-view-edit-button-container">'
            +'<div class="event-view-save-button">Save</div>'
            +'<div class="event-view-delete-button">Delete</div>'
        +'</div>'

    var eventTemplateEditButton = '<div class="event-view-edit">Edit</div>'

    var filterCollectionTemplate = '<div id="filterButton">View Filter</div>'
        +'<div class="filter-collection-pane">'
            +'<div id="filterMenuButton">Add Filter</div>'
        +'</div>';

    var eventTemplateNewButton = '<div class="event-view-new">New</div>';

    var loginTemplate = '<span class="error"></span>'
        +'<input type="text" name="ff-username" id="ff-username"/>'
        +'<label for="ff-username">Username</label>'
        +'<input type="password" name="ff-password" id="ff-password"/>'
        +'<label for="ff-password">Password</label>'

    var eventViewTemplate = Handlebars.compile(eventTemplate);
    var eventViewEditTemplate = Handlebars.compile(eventEditTemplate);
    var filterCollectionViewTemplate = Handlebars.compile(filterCollectionTemplate);



    //define all event objects
    var Event = Parse.Object.extend("Event");

    var EventCollection = Parse.Collection.extend({
        model: Event
    });

    var EventView = Parse.View.extend({
        tagName: "div",
        className: "event-view",
        events: {
            'click .event-view-expand' : 'toggleFolder',
            'click .event-view-album-href' : 'openLightbox',
            'click .event-view-edit' : 'edit',
            'click .event-view-delete-button' : 'delete',
            'click .event-view-save-button' : 'save',
            'change input' : 'updateAttribute',
            'change select' : 'updateAttribute',
            'mouseover' : 'hoverOver',
            'mouseleave' : 'hoverOut',
            'click' : 'zoomToMarker'
        },
        initialize: function() {
            _(this).bindAll('render', 'toggleFolder', 'getImages', 'openLightbox', 'createMarker', '_createMarker', 'hoverOver',
                'hoverOut', 'applyFilter', 'hide', 'show', 'edit', 'delete', 'save', 'updateAttribute', '_removeMarker',
                'checkMapVisibility', 'zoomToMarker');
            if(statesInUse.indexOf(this.model.get("state")) == -1) statesInUse.push(this.model.get("state"));
            if(citiesInUse.indexOf(this.model.get("city")) == -1) citiesInUse.push(this.model.get("city"));
            this.model.bind("applyFilter2", this.applyFilter);
            if(this.model.get("_isNew")) this._editing = true;
            this.model.bind('checkMapVisibility', this.checkMapVisibility);
            this.render();
            this._imagesLoaded = false;
            this.createMarker();
            this._editing = false;
            return this;
        },
        render: function() {
            var storeType = this.model.get("store_type_id");
            var e;
            if(!this._editing) {
                e = $(eventViewTemplate({
                    type: storeType.get("type_nm"),
                    start: $.datepicker.formatDate('mm/dd/yy', this.model.get("start_date")),
                    end: $.datepicker.formatDate('mm/dd/yy', this.model.get("end_date")),
                    city: this.model.get("city"),
                    state: this.model.get("state") ? this.model.get("state").toUpperCase() : "",
                    description: this.model.get("description"),
                    album: this.model.get("dropbox_album"),
                    onlineItem: this.model.get("hasOnlineItem")
                }));
                if(Parse.User.current() && Parse.User.current().authenticated()) {
                    var button = $(eventTemplateEditButton).button().addClass("event-view-edit-button");
                    $(e[4]).append(button);
                }
                $(this.el).html(e);
            }
            else {
                e = $(eventViewEditTemplate({
                    start: $.datepicker.formatDate('mm/dd/yy', this.model.get("start_date")),
                    end: $.datepicker.formatDate('mm/dd/yy', this.model.get("end_date")),
                    publish_start: $.datepicker.formatDate('mm/dd/yy', this.model.get("publish_date")),
                    publish_end: $.datepicker.formatDate('mm/dd/yy', this.model.get("unpublish_date")),
                    state: this.model.get("state"),
                    city: this.model.get("city"),
                    album: this.model.get("album"),
                    onlineItem: this.model.get("hasOnlineItem") ? true : false,
                    description: this.model.get("description")
                }));
                $(this.el).html(e);
                var self = this;
                storeTypeCollection.each(function(type){
                    $(e[0]).append(
                        "<option value='" + type.id + "' " +
                        ((self.model.get("store_type_id").id == type.id) ? "selected" : "") +
                        ">" + type.get("type_nm") + "</option>"
                    );
                });
                if(!this.model.get("_isNew")) {
                    $(e[0]).chosen().trigger("change");
                }
                $(".date", e).datepicker();
                $(e[6].children).button();
            }
            iframeResize();
        },
        toggleFolder: function(e) {
            this.getImages();
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
        getImages: function() {
            if(this._imagesLoaded || !this.model.get("dropbox_album")) {
                this._imagesLoaded = true;
                return;
            }
            var self = this;
            Parse.Cloud.run("getImagesForEvent", {url: this.model.get("dropbox_album")}, {
                success: function(results){
                    var append = '';
                    _.each(results, function(image, index){
                        append+="<a href='"+image.url+"' class='lightbox' rel='"+self.model.id+"'></a>";
                    });
                    $(".images", self.el).append(append);
                    $(".lightbox", self.el).lightbox({
                        scaleImages: true,
                        fitToScreen: true,
                        imageClickClose: false
                    });
                    $(".event-view-album-loading").hide();
                }
            });
            this._imagesLoaded = true;
        },
        openLightbox: function(e) {
            e.preventDefault();
            e.stopPropagation();
            $('.lightbox:first', this.el).click();
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
                var storeType = this.model.get("store_type_id");
                var marker = new google.maps.Marker({
                    map: map,
                    position: new google.maps.LatLng(this.model.get("location").lb, this.model.get("location").mb),
                    icon: storeType.get("icon") ? ("https://fixturefinders.parseapp.com/icons/"+storeType.get("icon")) : null
                });
                var self = this;
                google.maps.event.addListener(marker, 'click', function() {
                    $(".event-view-expand", self.el).click();
                    $("#event-listings").scrollTop($(self.el).position().top-20);
                    console.log($(self.el).position());
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
                    case "store_type_id":
                        var storeType = self.model.get("store_type_id");
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
        edit: function() {
            this._editing = true;
            this.render();
        },
        delete: function() {
            this.model.set("disable_date", new Date());
            this.model.save();
            this._removeMarker();
            this.remove();
        },
        save: function() {
            var isNew = this.model.get("_isNew");
            var self = this;
            delete this.model._opSetQueue[0]._isNew; //hack way to remove the attribute
            getGeocodeForEvent(
                {
                    city: this.model.get("city"),
                    state: this.model.get("state")
                },
                function(location) {
                    self.model.set("location", {lb: location.lat(), mb: location.lng()});
                    self.model.save();
                    self._editing = false;
                    self.render();
                    self.createMarker();
                }
            )
        },
        updateAttribute: function(e) {
            var self = this;
            var input = $(e.currentTarget);
            $.each(classToAttr, function(classToFind, props) {
                if(input.hasClass(classToFind)) {
                    switch(props.type) {
                        case 'date':
                            var dateString = input.val();
                            var year = dateString.substring(6, 11);
                            var month = parseInt(dateString.substring(0, 2)) - 1;
                            var day = dateString.substring(3,5);
                            var val = new Date(year, month, day);
                            break;
                        case 'bool':
                            var val = input.is(":checked");
                            break;
                        case 'store_type':
                            var val = new StoreType({id: input.val()});
                            val.fetch();
                            break;
                        case 'text':
                        default:
                            var val = input.val();
                            break;
                    }
                    self.model.set(props.attr, val);
                    return;
                }
            });
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

    var EventCollectionView = Parse.View.extend({
        tagName: "div",
        className: 'event-collection-view',
        el: $("#event-listings"),
        initialize: function() {
            _(this).bindAll('render', 'renderEvent', 'applyFilter', 'renderNewButton', 'removeNewButton', 'renderNew');
            this._newButton = null;
            this.collection.bind("fetch", this.render);
            this.collection.bind("applyFilter", this.applyFilter);
            this.bind("login", this.renderNewButton);
            this.bind("logout", this.removeNewButton);
        },
        render: function() {
            var self = this;
            this.collection.each(function(eventData) {
                self.renderEvent(eventData, false);
            });
            statesInUse.sort();
            citiesInUse.sort();
            if(Parse.User.current() && Parse.User.current().authenticated()) this.renderNewButton();
            checkAvailableEventsMessage();
        },
        renderNewButton: function() {
            if(!this._newButton) {
                this._newButton = $(eventTemplateNewButton)
                    .button()
                    .removeClass("ui-corner-all")
                    .addClass("ui-corner-tr ui-corner-tl")
                    .addClass("event-view-new-button");

                var self = this;
                this._newButton.click(function(){ //this is because it's being appended outside this.el so the events object doesn't catch it
                    self.renderNew();
                });
            }
            else {
                $("#filterButton").after(this._newButton);
            }
        },
        renderNew: function() {
            var newEvent = new Event();
            newEvent.set("store_type_id", storeTypeCollection.models[0]);
            this.collection.add(newEvent);
            this.renderEvent(newEvent, true);
        },
        removeNewButton: function() {
            this._newButton.remove();
        },
        renderEvent: function(eventData, isNew) {
            if(isNew) eventData.set("_isNew", true);
            var eventView = new EventView({
                model: eventData
            });
            if(isNew) {
                $(eventView.el).prependTo(this.el);
                $('select', eventView.el).chosen();
                //$('.date', eventView.el).datepicker();
            }
            else $(eventView.el).appendTo(this.el);
        },
        applyFilter: function() {
            this.collection.each(function(event) {
                event.trigger("applyFilter2");
            });
        }
    });



    //define all filter objects
    var Filter = Parse.Object.extend("Filters");

    var FilterCollection = Parse.Collection.extend({
        model: Filter
    });

    var FilterView = Parse.View.extend({
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
                el.chosen(); //weird bug... can't be called until after it's in the DOM
            }
        },
        renderDate: function(column) {
            var el = $("<input type='text' />")
                .datepicker()
                .css("width", "8em");
            return el;
        },
        renderString: function(column) {
            var el = $("<select><option></option></select>");
            switch(column) {
                case "store_type_id":
                    storeTypeCollection.each(function(type){
                        el.append("<option value='"+type.id+"'>"+type.get("type_nm")+"</option>");
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
        renderInventory: function(column) {
            var el =$("<span>Click to View</span>").addClass("filter-inventory");
            return el;
        },
        generateFilterTitle: function() {
            var el = $("<span>"+this.model.get("shortName")+"</span>")
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

    var FilterCollectionView = Parse.View.extend({
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

            eventCollectionView.trigger("login"); //to attach the login button if filters took a while to load
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

    var FilterMenuView = Parse.View.extend({
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

    var FilterMenuCollectionView = Parse.View.extend({
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


    // define login stuff
    var LoginButtonView = Parse.View.extend({
        tagName: "li",
        className: "page-collection ff-login-button",
        events: {
            'click' : 'handleButton'
        },
        initialize: function() {
            _(this).bindAll('render', 'handleButton');
            this.render();
            this.loginHandler = null;
        },
        render: function() {
            var el = $(this.el);
            var buttonText = (Parse.User.current() && Parse.User.current().authenticated()) ? "Logout" : "Login";
            el.append('<a href="#">'+buttonText+'</a><span class="delimiter">');
        },
        handleButton: function(e) {
            e.preventDefault();
            if(Parse.User.current() && Parse.User.current().authenticated()) this.loginHandler.trigger("logout");
            else this.loginHandler.trigger("openDialog");
        }
    });

    var LoginView = Parse.View.extend({
        tagName: "div",
        className: "login-view",
        events: {
            'keydown input' : 'handleKeydown'
        },
        initialize: function() {
            _(this).bindAll('render', 'openDialog', 'handleKeydown', 'login', 'logout', 'loginSuccess', 'loginError');
            this.bind("openDialog", this.openDialog);
            this.bind("logout", this.logout);
            this.render();
        },
        render: function() {
            var el = $(this.el).append(loginTemplate);
            var self = this;
            el.dialog({
               autoOpen: false,
               modal: true,
               resizable: false,
               draggable: false,
               buttons: [
                   {
                       text: "Login",
                       click: self.login
                   }
               ]
            });
        },
        openDialog: function() {
            $(this.el).dialog("open");
        },
        handleKeydown: function(e) {
            if(e.which == 13) {
                switch(e.currentTarget) {
                    case $("#ff-username")[0]:
                        $("#ff-password").focus();
                        break;
                    case $("#ff-password")[0]:
                        this.login();
                }
            }
        },
        login: function() {
            $(".error", this.el).empty().removeClass("ui-state-error");
            var username = $("#ff-username").val();
            var password = $("#ff-password").val();
            var self = this;
            Parse.User.logIn(username, password, {
                success: self.loginSuccess,
                error: self.loginError
            });
        },
        logout: function() {
            Parse.User.logOut();
            $(".ff-login-button a").text("Login");
            eventCollectionView.trigger("logout");
        },
        loginSuccess: function(user) {
            $(".error", this.el).empty().removeClass("ui-state-error");
            $(".ff-login-button a").text("Logout");
            $(this.el).dialog("close");
            $("#ff-username").val("");
            $("#ff-password").val("");
            eventCollectionView.trigger("login");
        },
        loginError: function(user, error) {
            if(error.code ==101) $(".error", this.el).prepend("Invalid Username or Password").addClass('ui-state-error');
            else $(".error", this.el).prepend("Something went wrong").addClass('ui-state-error');
            $("#ff-username").focus();
        }
    })

    // define store types

    var StoreType = Parse.Object.extend("Store_Types");

    var StoreTypeCollection = Parse.Collection.extend({
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

    var loginView = new LoginView();
    $(".main-nav ul").each(function(index, element) {
        var loginButtonView = new LoginButtonView();
        loginButtonView.loginHandler = loginView;
        $(element).append(loginButtonView.el);
    });
    $("#mobile-navigation ul").each(function(index, element) {
        var loginButtonView = new LoginButtonView();
        loginButtonView.loginHandler = loginView;
        $(element).append(loginButtonView.el);
    });

    function getEvents(){
        Parse.Cloud.run("getEvents", {}, {
            success: function(results){
                eventCollection.add(results);
                eventCollection.trigger("fetch");
            }
        });
    }

    function getFilters(){
        Parse.Cloud.run("getFilters", {}, {
            success: function(results){
                filterCollection.add(results);
                filterCollection.trigger("fetch");
            }
        });
    }

    function getStoreTypes(){
        Parse.Cloud.run("getStoreTypes", {}, {
            success: function(results){
                storeTypeCollection.add(results);
            }
        });
    }



    getEvents();
    getFilters();
    getStoreTypes();
    iframeResize();
};

function checkAvailableEventsMessage(){
    if($(".event-view", "#events").is(":visible")) $("#event-listing-none").hide();
    else $("#event-listing-none").show();
}

function setupMap(){
    var mapOptions = {
        center: new google.maps.LatLng(39.876019,-95.581055),
        zoom: 3,
        minZoom: 3,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false
    };

    map = new google.maps.Map(document.getElementById("map"), mapOptions);
    google.maps.event.addListener(map, 'center_changed', checkVisibleMarkers);
    google.maps.event.addListener(map, 'zoom_changed', checkVisibleMarkers);

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

function getGeocodeForEvent(location, cb){
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({address: location.city+", "+location.state}, function(results, status){
        if(status=='OK') cb(results[0].geometry.location);
        else cb(null);
    });
}

function loadJSDependencies(callback) {
    var deps = [
        '{ff}jquery-1.8.3.js',
        '{ff}jquery-ui-1.9.2.custom.min.js',
        '{ff}underscore-min.js',
        '{ff}backbone.js',
        '{ff}handlebars.js',
        '{ff}chosen.jquery.min.js',
        'https://www.parsecdn.com/js/parse-1.2.7.min.js',
        '{ff}jquery.lightbox.js'
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
        '{ff}css/lightbox.css',
        '{ff}style.css'
    ];

    for(var i=0; i<files.length; i++) {
        document.write('<link rel="stylesheet" type="text/css" href="'+files[i].replace("{ff}", path)+'">');
    }
}

if(typeof jQuery != 'undefined') $(function(){
    /*if(isMSIE)*/ setupMap();
    $('body').css("overflow", "hidden");
});
else {
    loadJSDependencies(setupMap);
    loadCSS();
}
