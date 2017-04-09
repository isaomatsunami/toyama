$(function(){
	// DjangoのCSRF対策に通過するため、Backbone.syncに前処理を加える
	function getCookie(name) {
		var cookieValue = null;
		if (document.cookie && document.cookie != '') {
			var cookies = document.cookie.split(';');
			for (var i = 0; i < cookies.length; i++) {
				var cookie = jQuery.trim(cookies[i]);
				if (cookie.substring(0, name.length + 1) == (name + '=')) {
					// Does this cookie string begin with the name we want?
					cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
					break;
				}
			}
		}
		return cookieValue;
	};
	var baseSync = Backbone.sync;
	Backbone.sync = function(method, model, options){
		options.beforeSend = function(xhr){
			var csrf = getCookie('csrftoken');
			xhr.setRequestHeader("X-CSRFToken", csrf);
		};
		return baseSync(method, model, options);
	};
	// verbose = console.log;
	verbose = function(){};

	var Info = Backbone.Model.extend({
		defaults: function(){
			return {
				rep_name: "",		// 議員名
				doc_number: "",		// 整理番号
				usage_type: "",		// 使途分類
				usage: "",			// 使途但し書き
				date_of_issue: "",  // 日時
				price: 0,			// 金額
				rate: 100,			// 率
				memo: "",			// 予備
				ref_image_id:   null,	// 参照画像（このデータが参照する画像のID）
				ref_image_left: 100,	// 位置
				ref_image_top:  100,	// 位置
				cap_image_id:   null,	// キャプチャー画像のid
				cap_image_left:   0,	// 位置
				cap_image_top:    0,	// 位置
				cap_image_width:  0,	// 位置 width=0の場合、無効を意味する
				cap_image_height: 0,	// 位置
				cap_direction: "上",	// キャプチャー画面の上方向
				cap_image_base64: "",	// base64のキャプチャー画面
				owner: "",
				active: true
			};
		},
		idAttribute: "id",
	});

	var ImageInfo = Backbone.Model.extend({
		idAttribute: "id",
		url: '/toyama/api/imageinfos/'
	});

	var InfoList = Backbone.Collection.extend({
		model: Info,
		url: '/toyama/api/documentinfos/',
		// InfoListのなかで、編集対象のモデルインスタンスを設定する。nullなら全部解除
		setActive: function(_model) {
			this.each(function(_info){
				// このsetが全modelにchangeイベントを送る
				if(_model === null){
					_info.set("active", false);
				}else{
					_info.set("active", _info.id == _model.id);
				}
			});
			this.activeModel = _model;
		},
		activeModel: null
	});

	var Infos = new InfoList;

	var InfoView = Backbone.View.extend({
		tagName:  "div",
		className:  "info",
		template: _.template($('#item-template').html()),
		initialize: function() {
			var that = this, _Infos = Infos;
			this.listenTo(this.model, 'destroy', this.removing); // モデルが壊れたらelを除く
			this.listenTo(this.model, 'change', this.activated); // モデルが変更されたら

			// d3によるドラッグを準備する
			this.drag = d3.drag().on("start", todrag).on("end", dragged).on("drag", dragging);
			function todrag(){
				// アクティブになったときも呼ばれる
				_Infos.setActive( that.model );
			}
			function dragged(){
				that.model.save();
			}
			function dragging(){
				d3.select(this).style("left", d3.event.x + "px").style("top", d3.event.y + "px");
				var d = d3.select(this).datum();
				that.model.attributes.ref_image_left = d.x = d3.event.x;
				that.model.attributes.ref_image_top  = d.y = d3.event.y;
			}

			// DocumentInfoの設定をする
			d3.select(this.el).datum({
				x: this.model.attributes.ref_image_left,
				y: this.model.attributes.ref_image_top
			}).call(this.drag);

			this.render();
			// タブインデックスを設定する
			this.$el.find("[data-tabindex]").each(function(i,el){
				$(this).attr("tabindex", $(this).attr("data-tabindex") );
			});
		},

		removing: function(_model) {
			// _modelは削除されるモデル、thisはInfoViewインスタンス
			this.remove();
		},

		activated: function(_model) {
			verbose("Model:activated", _model);
			// 再描画
			this.render();
			// _modelは削除されるモデル(=this.model)、thisはInfoViewインスタンス
			if( this.model.get("active") ){
				this.$el.removeClass('deactivated');
				// タブインデックスを設定する
				this.$el.find("[data-tabindex]").each(function(i,el){
					$(this).attr("tabindex", $(this).attr("data-tabindex") );
				});
			}else{
				this.$el.addClass('deactivated');
				// タブインデックスを削除する
				this.$el.find("[data-tabindex]").each(function(i,el){
					$(this).removeAttr("tabindex");
				});
			}
			return this;
		},

		render: function() {
			verbose("rendering")
			var d = this.model.toJSON();

			if(d.cap_image_id){
				var range = [d.cap_image_left,d.cap_image_top,d.cap_image_width,d.cap_image_height]
				d.cap_range_text = "(" + range.map(function(d){return parseInt(d)}) + ")";
			}else{
				d.cap_range_text = "";
			}

			var imgHeight = 25;
			if(d.cap_image_id === null){
				d.cap_height = 0;
				d.cap_width = 0;
			}else{
				if((d.cap_direction == "上") || (d.cap_direction == "下")){
					d.cap_height = imgHeight;
					d.cap_width = imgHeight * d.cap_image_width / d.cap_image_height;
				}else{
					d.cap_width = imgHeight;
					d.cap_height = imgHeight * d.cap_image_width / d.cap_image_height;
				}
			}
			this.$el.html(this.template(d));
			this.$el.css({
				"left": this.model.attributes.ref_image_left,
				"top":  this.model.attributes.ref_image_top
			});
			// render直後はsaveボタンは無効
			this.$el.find(".bt_save").hide();
			// モデルにviewを辿れるようにする
			this.model.view = this;
			return this;
		},

		// 要素ごとにイベントを登録する
		events: {
			"blur .edit_text"      : "closeText",
			"keypress .edit_text"  : "updateText",
			"blur .edit_num"       : "closeNum",
			"keypress .edit_num"   : "updateNum",
			"change .select_option"  : "updateSelect",
			"click .bt_save"       : "saveModel",
			"click .bt_delete"     : "deleteModel"
		},

		// text要素がフォーカスを失った時
		closeText: function(e) {
			var currentTarget = $(e.currentTarget),
				field = currentTarget.attr("data-field"),
				value = currentTarget.val();
			this.model.set(field, value);
			verbose("updateText", field, value);
			this.$el.find(".bt_save").show();
		},
		// text要素でリターンを打たれた時
		updateText: function(e) {
			if (e.keyCode == 13){
				var currentTarget = $(e.currentTarget),
					field = currentTarget.attr("data-field"),
					value = currentTarget.val();
				this.model.set(field, value);
				verbose("updateText", field, value);
				this.$el.find(".bt_save").show();
			}
		},
		// text要素（数字要素の場合）リターンを打たれた時
		closeNum: function(e) {
			var currentTarget = $(e.currentTarget),
				field = currentTarget.attr("data-field"),
				value = currentTarget.val();
			this.model.set(field, Number(value) );
			verbose("updateNumber", field, value);
			this.$el.find(".bt_save").show();
		},
		updateNum: function(e) { // returnの場合は終了
			if (e.keyCode == 13){
				var currentTarget = $(e.currentTarget),
					field = currentTarget.attr("data-field"),
					value = currentTarget.val();
				this.model.set(field, Number(value));
				verbose("updateText", field, value);
				this.$el.find(".bt_save").show();
			}
		},
		// select要素の変更を反映する
		updateSelect: function(e) {
			var currentTarget = $(e.currentTarget),
				field = currentTarget.attr("data-field"),
				value = currentTarget.val();
			//この方法ならイベントを避けられる
			this.model.attributes[field] = value;
			verbose("updateSelect", field, value);
			this.$el.find(".bt_save").show();
		},
		// 保存ボタンを押された場合
		saveModel: function() {
			this.model.save();
			this.$el.find(".bt_save").hide();
		},
		// 削除ボタンを押された場合
		deleteModel: function() {
			if (window.confirm("削除しますか?")) {
				this.model.destroy();
			}
		}
	});

	// Application本体
	var AppView = Backbone.View.extend({
		el: $("#app"),
		initialize: function() {
			imat.webapp.initMenu();
			this.addButton = $("#addInfo");
			this.addButton.on("click", this.addOne.bind(this));
			this.checkButton = $("#checkInfo");
			this.checkButton.on("click", this.checkInfo.bind(this));
			this.title = $("#doc_id");
			this.viewer = new docViewer("app");

			this.listenTo( Infos, 'add', this.createOne );	// モデルが一つ追加された
			this.listenTo( Infos, 'remove', this.removed );	// モデルが除かれた
			this.listenTo( Infos, 'change', this.activated);// モデルの属性が変更された

			this.listenTo( this.viewer.dispatcher, 'change.url', this.changeImage );
			this.listenTo( this.viewer.dispatcher, 'change.brush', this.changeBrush );

			// チェックする画像に関する情報を読み込む
			this.targetImage = new ImageInfo();
			this.targetImage.fetch({"success":this.targetLoaded.bind(this)});
		},
		targetLoaded: function(_targetModel){ // _modelはtargetModel
			var strID = String(_targetModel.id);
			this.title.text(strID);
			Infos.fetch({
				data:{'ref_image_id': strID},
				processData: true
			});
			this.viewer.setTargetID(strID);
		},
		// addInfoボタンが押された場合
		addOne: function(e){
			verbose("addOne", e, this);
			Infos.create({'ref_image_id': this.targetImage.id});
		},
		// checkInfoボタンが押された場合
		checkInfo: function(e){
			verbose("checkInfo", e, this.targetImage.url);
			this.targetImage.url = '/toyama/api/imageinfos/' + this.targetImage.id
			this.targetImage.set({"done": true}).save();
			// 念のため、モデルを全部保存する必要があるか？
			// 再読み込みする
			window.location.reload();
		},
		// InfoListにモデルが追加された場合
		createOne: function(_model, _collection, _options){
			// fetchで複数のモデルが読み込まれた場合、各モデルごとに呼ばれる
			// verbose("created", _model, _collection, _options);
			Infos.setActive(_model);	// 追加されたものがActiveになる
			var _view = new InfoView({model: _model});
			$("#app").append(_view.el);
		},
		// InfoListからモデルが削除された場合（）
		removed: function(_model, _collection, _options){
			verbose("removed", _model, _collection, _options);
			_model.view.remove();
			// 残りをアクティブにする
			if(_collection.length > 0){
				Infos.setActive( Infos.at(0) );
			}else{
				Infos.setActive(null);
				this.viewer.setBrush(null);
			}
		},
		// InfoList内のモデルに変更があった場合
		activated: function(_model, _options) {
			// activeでないものは処理しない
			if( !_model.get("active") ) return;
			// 画像があり、かつ、キャプチャー対象ならキャプチャー領域を追加する
			var image_id = this.viewer.getCurrentID();
			verbose("app:activated", _model, _options, image_id);
			if((image_id !== null) && (_model.get("cap_image_id") == image_id)){
				var l = _model.get("cap_image_left"),
					t = _model.get("cap_image_top"),
					w = _model.get("cap_image_width"),
					h = _model.get("cap_image_height");
				this.viewer.setBrush([[l,t],[l + w, t + h]]);
			}else{
				this.viewer.setBrush(null);
			}
		},
		// viewerの表示画像が変更された場合
		changeImage: function(params) {
			// ベース画像にしか、docInfoは追加できない
			if(this.viewer.displayingBaseImage()){
				this.addButton.css('display', 'inherit');
				this.checkButton.css('display', 'inherit');
			}else{
				this.addButton.css('display', 'none');
				this.checkButton.css('display', 'none');
			}
			_model = Infos.activeModel;
			// activeなモデルがないならやることはない
			if(_model === null) return;
			// アクティブDocumentInfoのキャプチャー対象の場合、キャプチャー領域を追加する
			verbose("changeImage", params.image_id, _model.attributes.cap_image_id);
			if((_model !== null) && (_model.attributes.cap_image_id == params.image_id)){
				var l = _model.get("cap_image_left"),
					t = _model.get("cap_image_top"),
					w = _model.get("cap_image_width"),
					h = _model.get("cap_image_height");
				this.viewer.setBrush([[l,t],[l + w, t + h]]);
			}else{
				this.viewer.setBrush(null);
			}
		},
		// Brushが変更された場合
		changeBrush: function(params) {
			verbose("changeBrush",params,this);
			if( Infos.activeModel ){
				Infos.activeModel.set(params).save();
			}else{
				// 対象がないならBrushを無効にする
				this.viewer.setBrush(null);
			}
		}
	});
	var App = new AppView;
});

var docViewer = function (targetID, options) {
	/*
	docViewer: サーバーと協調して、チェック対象の画像を表示する。参照画面を探すことができる（背景が黒になる）
	method:
		setTargetID(_id): idの画像を表示。idは整数
		getCurrentID(): 表示中の画像のID
		setBrush([[x0, y0], [x1, y1]]かnull)
		displayingBaseImage(): ベース画像を表示中
	event:
		change.urlイベント: 表示中の画像が変更された時。引数は{image_id:表示中の画像のid}
		change.brushイベント: 
			引数は{"cap_image_id": 画像のid,"cap_image_left","cap_image_top","cap_image_width","cap_image_height"}
			brush解除の場合は{"cap_image_id": null, "cap_image_height":0, "cap_image_width":0}
	*/
	this.targetElement = document.getElementById(targetID);
	this.targetSelector = "#" + targetID;
	this.targetID = targetID;
	var s = this.settings = {};
	for(var prop in this.defaults){
		if( this.defaults.hasOwnProperty(prop) ) this.settings[prop] = this.defaults[prop];
	}
	for(var prop in options){
		if( options.hasOwnProperty(prop) ) this.settings[prop] = options[prop];
	}
	this._name = this.settings.chartType + ':' + targetID;
	this.init();
};
docViewer.prototype = {
	defaults : {
		chartType:'docViewer',
		width: 1000, height: 1000,
		margin: {top:30, left:10, bottom:10, right:10}
	},
	init: function(){
		var s = this.settings, that = this;
		var innerWidth = s.width - s.margin.right - s.margin.left;
		var innerHeight= s.height - s.margin.top - s.margin.bottom;

		var dispatcher = this.dispatcher = {};
		_.extend( dispatcher, Backbone.Events );

		// 背景描画
		var _target = d3.select(this.targetElement);
		var _svg = this.svg = _target.append("svg")
			.style("position", "absolute")
			.style("overflow", "hidden")
			.style("background-color", "lightgrey")
			.attr("height", s.height)
			.attr("width",  s.width);

		this.ratio = 0, // 画像の縮尺
		this.offsetX = 0, // 画像の位置 
		this.offsetY = 0,
		this.width = 0,
		this.height = 0,
		this.current_id = null;
		this.silent = false;

		this.brush = d3.brush().on("end", brushended);
		function brushended() {
			verbose("brushended", d3.event.selection);
			if (!d3.event.selection){
				// brushが空の場合
				if (that.silent) return;
				dispatcher.trigger("change.brush", {
					"cap_image_id": null,
					"cap_image_width":  0,
					"cap_image_height": 0
				});
				return;
			}
			// selectionは整数化されている
			var s = d3.event.selection,
				x0 = s[0][0],
				y0 = s[0][1],
				dx = s[1][0] - x0,
				dy = s[1][1] - y0;
			// offsetを反映する
			var left = (x0 - that.offsetX) / that.ratio,
				top  = (y0 - that.offsetY) / that.ratio,
				w = dx / that.ratio,
				h = dy / that.ratio;

			if (that.silent) return;
			dispatcher.trigger("change.brush", {
				"cap_image_id": that.current_id,
				"cap_image_left": left,
				"cap_image_top":  top,
				"cap_image_width":  w,
				"cap_image_height": h
			});
		}

		var _base = _svg.append("g")
			.attr("transform", "translate(" + s.margin.left + "," + s.margin.top + ")");
		this.gBrush = _base.append("g");
		var _image = this._image = this.gBrush.append("image")
			.attr("PreserveAspectRatio", "xMinYMin")
			.attr("width", innerWidth)
			.attr("height", innerHeight);
		var _text = this._text = _svg.append("text") // 表示中の画像のID
			.attr("x", 5)
			.attr("y", 18)
			.style("font-size", 14);

		var _prev = this._prev = _svg.append("g").attr("class","prev")
			.attr("transform", "translate(" + (innerWidth/2 - 80) + ",5)")
			.on("click", function(d){
				that.load( d3.select(this).attr("data_id") );}
			);
			_prev.append("rect").attr("width", 60).attr("height", 20);
			_prev.append("text")
				.attr("x", 30).attr("y", 15)
				.text("Prev");
		var _back = this._back = _svg.append("g").attr("class","back")
			.attr("transform", "translate(" + innerWidth/2 + ",5)")
			.on("click", function(d){
				that.load( d3.select(this).attr("data_id") );}
			);
			_back.append("rect").attr("width", 60).attr("height", 20);
			_back.append("text")
				.attr("x", 30).attr("y", 15)
				.text("Back");
		var _next = this._next = _svg.append("g").attr("class","next")
			.attr("transform", "translate(" + (innerWidth/2 + 80) + ",5)")
			.on("click", function(d){
				that.load( d3.select(this).attr("data_id") );}
			);
			_next.append("rect").attr("width", 60).attr("height", 20);
			_next.append("text")
				.attr("x", 30).attr("y", 15)
				.text("Next");
		this.gBrush.call(this.brush);
	},
	setTargetID: function(_id){ // _idは文字列
		this.targetID = _id;
		this._back.attr("data_id", _id);
		this.load(_id);
	},
	setBrush: function(_range){ // _rangeはnullか[[x0, y0], [x1, y1]]
		// 本体から設定された場合はイベントを発行させない（ループしてしまうから）
		this.silent = true;
		if(_range === null){
			this.brush.move(this.gBrush, _range);
		}else{
			var r = [
				[ Math.round(_range[0][0] * this.ratio + this.offsetX), Math.round(_range[0][1] * this.ratio + this.offsetY)],
				[ Math.round(_range[1][0] * this.ratio + this.offsetX), Math.round(_range[1][1] * this.ratio + this.offsetY)]
			];
			this.brush.move(this.gBrush, r);
		}
		this.silent = false;
	},
	load: function(_id){ // _idは文字列
		var s = this.settings, that = this;
		var innerWidth = s.width - s.margin.right - s.margin.left;
		var innerHeight= s.height - s.margin.top - s.margin.bottom;
		var dispatcher = this.dispatcher;

		function loadImage(id){
			d3.json( "api/imageinfos/" + id, setImage);
		}

		this.base_aspect = innerHeight / innerWidth; // SVGのアスペクト

		function setImage(_err, _json){
			// verbose(_json);
			_json.height = Number(_json.height);
			_json.width  = Number(_json.width);
			var image_aspect = _json.height/_json.width; // 画像のアスペクト
			if( that.base_aspect > image_aspect){
				// 中身が横長
				that.ratio = innerWidth / _json.width;
				that.offsetX = 0;
				that.offsetY = (innerHeight - (_json.height * that.ratio) )/ 2.0;
				that.width = innerWidth;
				that.height = _json.height * that.ratio;

			}else{
				that.ratio = innerHeight / _json.height;
				that.offsetX = (innerWidth - (_json.width * that.ratio) )/ 2.0;
				that.offsetY = 0;
				that.width = _json.width * that.ratio;
				that.height = innerHeight;
			}
			that._image
				.attr("x", that.offsetX)
				.attr("y", that.offsetY)
				.attr("width", that.width)
				.attr("height", that.height)
				.attr("xlink:href", "static/toyama/images/pdf/images/" + _json.url);

			that.current_id = _json.id;

			if(_json.prev_id){
				that._prev.attr("display", "inherit");
				that._prev.attr("data_id", String(_json.prev_id) );
			}else{
				that._prev.attr("display", "none");
			}
			if(_json.next_id){
				that._next.attr("display", "inherit")
				that._next.attr("data_id", String(_json.next_id) );
			}else{
				that._next.attr("display", "none");
			}
			if( String(_json.id) !== that.targetID){
				that._back.attr("display", "inherit")
				that.svg.style("background-color", "black");
				that._text.style("fill", "white");
			}else{
				that._back.attr("display", "none");
				that.svg.style("background-color", "lightgrey");
				that._text.style("fill", "black");
			}
			that._text.text(_json.id);

			dispatcher.trigger("change.url", {"image_id": that.current_id});
		}
		loadImage( _id );
	},
	displayingBaseImage(){
		return this.current_id == this.targetID;
	},
	getCurrentID(){
		return this.current_id;
	}
  };
