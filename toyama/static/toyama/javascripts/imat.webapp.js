var imat = imat || {};
imat.webapp = {
	"initMenu": function(){
		d3.selectAll(".extensible").selectAll("ul").style("display", "none");
		d3.selectAll(".extensible").selectAll("img, h4, button").on("click", function(){
			var ul = d3.select(this.parentNode).select("ul");
			var toggle = ul.style("display") == "none" ? "inline" : "none";
			ul.style("display", toggle);
		});
		d3.select("#btFooter").on("click", function(){
   		 	var toggle = d3.select(this).text() == "閉じる";
    		if(toggle){
				d3.select(this).text("開く");
				d3.select("#webapp_bottom_fixed").transition().style("bottom", -35 + "px");
			}else{
				d3.select(this).text("閉じる");
				d3.select("#webapp_bottom_fixed").transition().style("bottom", 0 + "px");
			}
		});
	},
	"writeText": function(_strings){
		if(window.File && window.FileReader && window.FileList && window.Blob){
			var blob = new Blob([_strings], {type:"text/plain"});
			var url = window.URL.createObjectURL(blob);
			// download window
			var dialogBox = d3.select(document.body).append("div")
				.attr("class", "dialog");
			dialogBox.append("div")
				.attr("id", "download_link")
				.html( '<a href="'+ url + '" target="_blank">Download</a>' ); 
			var cancelDiv = dialogBox.append("div")
				.html( 'Cancel' )
				.on("click", cancelled);
		}else{
			console.log("FileAPIに対応していません");
		}
		function cancelled(){
			cancelDiv.on("click", null);
			dialogBox.remove();
			dialogBox = cancelDiv = null;
		}
	},
	"writeCanvas": function(_canvas){
		if(window.File && window.FileReader && window.FileList && window.Blob){
			var url = _canvas.toDataURL("image/png");
			// download window
			var dialogBox = d3.select(document.body).append("div")
				.attr("class", "dialog");
			dialogBox.append("div")
				.attr("id", "download_link")
				.html( '<a href="'+ url + '" target="_blank">Download</a>' ); 
			var cancelDiv = dialogBox.append("div")
				.html( 'Cancel' )
				.on("click", cancelled);
		}else{
			console.log("FileAPIに対応していません");
		}
		function cancelled(){
			cancelDiv.on("click", null);
			dialogBox.remove();
			dialogBox = cancelDiv = null;
		}
	},
	"loadText": function(_callback){
		if(window.File && window.FileReader && window.FileList && window.Blob){
			// download window
			var dialogBox = d3.select(document.body).append("div")
				.attr("class", "dialog");
			dialogBox.append("div")
				.html( 'Select a text file: <input type="file" id="fileInput">' ); 
			var cancelDiv = dialogBox.append("div")
				.html( 'Cancel' )
				.on("click", cancelled);

			var fileInput = document.getElementById('fileInput');
			fileInput.addEventListener('change', function(e) {
				var _cancelled = cancelled;

				var file = fileInput.files[0];
				var textType = /text.*/;

				if (file.type.match(textType)) {
					var reader = new FileReader();
					reader.onload = function(e) {
						_cancelled();
						_callback( reader.result );
					}
					reader.readAsText(file);	
				}else{
					console.log("ファイルフォーマットがtextではない");
				}
			});
		}else{
			console.log("FileAPIに対応していません");
		}
		function cancelled(){
			cancelDiv.on("click", null);
			dialogBox.remove();
			dialogBox = cancelDiv = null;
		}
	}
}
