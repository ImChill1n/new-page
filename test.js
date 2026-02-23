(function($) {
$.fn.etestPlayer = function(options) {        
    var opts = $.extend( {}, $.fn.etestPlayer.defaults, options);
   
	function main() {       
		
    	var mainElem = $(this);
		var materialObj = null;    
		var superObj = null;
	   	var superRow = null;
	   	
	    var headerElem = null
	    var contentElem = null;
	    var sideElem = null;   
	    var loadingElem = null;
	    var playerContentElem = null;
		var wndEnforcementElem = null;
	    var interactiveElems = {};
	    
		var mainWidget = null;
		var screenWidget = null;
	    
	    var resultsData = {};
	    var pridelenieidNaUserid = {};
	    
	    var cardids = [];
	    var cardsData = {};
	    var currentVariantid = 0; 
	    var questionWidgets = {};
	    
	    var playTimeStart = 0;
	    var playTimeInterval = null;
	        
	    var answersData = null;
		var answersValues = null;
		var seenData = null;
	    var isFinished = false;
		var finishedDuration = false;
    
    	var cardWidgetsWithAnswers = [];
    	var cardWidgets = [];
    	var headerHovered = false;
    	var headerHoverTimeout = null;
    	var sideElemShown = false;
    	
    	var rozdielServerCas = 0;
		var lastTimezoneOffset = null;
    	
		var casKonca = false;
		var casKoncaTrvanie = false;
    	
		var wasEdubarHidden = barEdubarHeaderIsHidden();
		
		var isWaiting = true;
		var isOfflineView = false;

		var somethingChanged = false;
		var somethingSaved = false;
		var scrollToTopAfterReload = false;

		var _casKoncaInitialized = false;
    	var lastSavedResultScoreData = null;

	    function initProperties(obj) {
	    	for (var x in obj) {
	    		opts[x] = obj[x];
	    	}    	    		    	
	    	if (obj.serverTime) {	 
				var cd = (new Date());
	    		rozdielServerCas = Date.fromDbString(opts.serverTime).getTime() - cd.getTime();  
				lastTimezoneOffset = cd.getTimezoneOffset();
			}
			currentVariantid = Math.round(ETestUtils.nextRandom('etestplayer')*1000000000);

			
			if (sessionStorage.getItem('eplid')) {
				opts.eplid = sessionStorage.getItem('eplid');			
			}

			if (opts.eplid) {
				sessionStorage.setItem('eplid',opts.eplid);
			}

			if (opts.playTimeStartStr) {				
				opts.playTimeStart = opts.playTimeStartStr;
			}			
		}

		var broadcastChannel = null;
		var playerInstanceId = ETestUtils.getRandomStr(20);
		function initEplid(doneFunc) {
			var mamsessionStorage = false;
			if (MobileAppBridge.isActive() && window["edupageAppEdid"]) {
				opts.eplid = ''+window["edupageAppEdid"];
				sessionStorage.setItem('eplid',opts.eplid);
			}
			if (sessionStorage.getItem('eplid')) {
				opts.eplid = sessionStorage.getItem('eplid');
				mamsessionStorage = true;
			}
			

			if (!broadcastChannel  && !MobileAppBridge.isActive() && typeof BroadcastChannel != 'undefined') {
				broadcastChannel = new BroadcastChannel('etestplayer');								 
				broadcastChannel.onmessage = function(ev) {
					
					if (ev.origin != window.origin) return;
					
					var msg = ev.data;
					if (!msg) return;
					if (!msg.action) return;
					if (msg.playerInstanceId == playerInstanceId) {						
						return; 
					}
						
					if (msg.action == 'verifyEplid' && msg.eplid == opts.eplid) {
						broadcastChannel.postMessage({action: 'haveSameEplid', eplid: opts.eplid, playerInstanceId: playerInstanceId});
					} else if (msg.action == 'haveSameEplid' && msg.eplid == opts.eplid) {
						delete opts.eplid;
						sessionStorage.removeItem('eplid');
					}
					
				}
			}

			

			if (mamsessionStorage && !MobileAppBridge.isActive() && broadcastChannel) {				
				broadcastChannel.postMessage({action: 'verifyEplid', eplid: opts.eplid, playerInstanceId: playerInstanceId});
				setTimeout(function() {
					doneFunc();
				},100);
			} else {
				doneFunc();				
			}			
		}


		
		function creteOfflineView() {
			isOfflineView = true;
			var s = '';
					
					
			s += '<div class="etest-offline-view">';
				s += '<div class="etest-offline-view-icon"><i class="material-icons">cloud_off</i></div>';
				s += lset(9883);
				
				s += '<div class="etest-offline-close-btn">';
					s += '<a class="flat-button flat-button-greenm flat-button-bigger withShadow actionButton" data-action="close">'+lset(1567)+'</a>';
				s += '</div>';
			s += '</div>';
							
			mainElem.html(s);
	
			
			mainElem.find('.actionButton').on('click',function(event) {
				handleActionButton(this, event);	 			
			}); 	
		}
	    
	    function initData() {	
			initEplid(function() {			
				if (opts.materialData) {	   			
					materialObj = new ETestMaterial(opts.materialData);		    	
					initData0();
				} else {
					ETestMaterial.createByDownload(opts, function(mobj, data) {
						materialObj = mobj;
						initProperties(data);
						initData0();
					}, function() {					
						creteOfflineView();	
					});
				}
			});
	    }
	    
	    function getCurrentTime() {
	    	var d = new Date();			
	    	d.setTime(d.getTime()+rozdielServerCas);
	    	return d;
		}

		function updateServerTime() {			
			if (updatingServerTime) return;
			updatingServerTime = true;			
			var jqxhr = $.post(opts.formurl+'&akcia=getServerTime', {}, function(data) {				
				var cd = (new Date());				
	    		rozdielServerCas = Date.fromDbString(data.serverTime).getTime() - cd.getTime();  
				lastTimezoneOffset = cd.getTimezoneOffset();
				updatingServerTime = false;				
				lastAutosave = Date.now();
				initializeTime();
			},'json').fail(function() {
				updatingServerTime = false;
			});
			jqxhr.isErrorHandled = true;
		}
		
		var _reloadAfterWaitingCounter = 0;
		var _reloadAfterWaitingTimeout = null;
	    function reloadAfterWaiting() {
			_reloadAfterWaitingCounter++;
			if (_reloadAfterWaitingCounter>2) {
				if (_reloadAfterWaitingTimeout) clearTimeout(_reloadAfterWaitingTimeout);
				_reloadAfterWaitingTimeout = setTimeout(function() {
					reloadAfterWaiting0();
				}, 5000);
			} else if (isContestMode()) {
				barStartLoading();
				barShowMessage(ls(3358), 30000);
				setTimeout(function() {					
					barEndLoading();
					reloadAfterWaiting0();
				}, Math.random()*20000);
			} else {
				reloadAfterWaiting0();
			}
		}
		function reloadAfterWaiting0() {
			barStartLoading();
			var jqxhr = $.post(opts.formurl+'&akcia=getETestData',{}, function(data) {
				$('body').children('.barMessageText').remove();
				barEndLoading();
				initProperties(data);
				initData();
			},'json').fail(function() {
				$('body').children('.barMessageText').remove();
				barEndLoading();
				creteOfflineView();	
			});
			jqxhr.isErrorHandled = true;
		}

		function reload() {
			barStartLoading();
			mainElem.toggleClass('etest-player-result',false);
			ETestMaterial.createByDownload(opts, function(mobj, data) {
				barEndLoading();
				materialObj = mobj;
				initProperties(data);
				initData0();
			}, function() {			
				barEndLoading();		
				creteOfflineView();	
			});
		}

		function initData0() {	
			stopTime(true);		
			if (materialObj && materialObj.hasVariantGroups && materialObj.hasVariantGroups()) {
				currentVariantid = Math.round(ETestUtils.nextRandom('etestplayer')*1000000000);
			} else {
				currentVariantid = 0;
			}
			initData1();
		}
		var restorableAnswersData = null
		function initData1(skipVysledokRow) {
			if (skipVysledokRow || !opts.superid || EdubarUtils.isUcitelOrAdmin()) {
				initData2(skipVysledokRow);
			} else {
				//skusime vytiahnut naposledy ulozene vysledky
				getLocalStorageResults(function(items) {					
					if (items && items.length>0) {
						var r =  items[0];						
						if (r && r.id) {
							getLocalStorageResultData(r.id, function(d) {								
								restorableAnswersData = d && d.data ? d : null;
								initData2(skipVysledokRow);//, d && d.data ? d.data : null);
								
							});
						} else {
							initData2(skipVysledokRow);
						}
					} else {
						initData2(skipVysledokRow);
					}
				})
			}
		}

	    function initData2(skipVysledokRow, restoreLocalAnswers) {
			isWaiting = true;
	    	isFinished = false;
			cardids = materialObj.cardids ? materialObj.cardids : [];   	
			 
	    	if (!skipVysledokRow && opts.vysledokRow && opts.vysledokRow.odpovedexml) {    	    						
	    		answersData = typeof opts.vysledokRow.odpovedexml === 'string' ? JSON.parse(opts.vysledokRow.odpovedexml) : opts.vysledokRow.odpovedexml;
	    		if (answersData && answersData.values) {
	    			answersValues = answersData.values;
	    			currentVariantid = answersData.variant ? answersData.variant : 0;
				}
				if (answersData && answersData.scoreData && answersData.scoreData.seenData) {
					seenData = answersData.scoreData.seenData;
				}
				
	    		isFinished = opts.vysledokRow.skoncil == '1' ? true : false; 
				finishedDuration = isFinished && answersData && answersData.scoreData ? answersData.scoreData.duration : false;
	    	} else if (!skipVysledokRow && restoreLocalAnswers) {				
				answersData = restoreLocalAnswers;
	    		if (answersData && answersData.odpovedexml && answersData.odpovedexml.values) {
					answersValues = answersData.odpovedexml.values;
					currentVariantid = answersData.odpovedexml.variant ? answersData.odpovedexml.variant : 0;
				}
				if (answersData && answersData.seenData) {
					seenData = answersData.seenData;
				}
				
				//isFinished = restoreLocalAnswers.skoncil;				
			}

			if (materialObj.materialData && materialObj.materialData.options && materialObj.materialData.options.variantid) {
				currentVariantid = materialObj.materialData.options.variantid;				
			}


	    	
	    	materialObj.currentVariantid = currentVariantid;	    	
	    	materialObj.cardsOnlyMode = !opts.testid;
			superObj = new ETestSuperPridelenie(opts.superRow, materialObj);							
			

			if (!playTimeStart) playTimeStart = getCurrentTime().getTime();
			if (opts.playTimeStart) {					
				playTimeStart = ETestUtils.isNumeric(opts.playTimeStart) ? opts.playTimeStart*1000 : Date.fromDbString(opts.playTimeStart).getTime();
			}
			casKonca = false;
			casKoncaTrvanie = false;
			if (!isFinished && superObj.superRow.trvanie && superObj.superRow.trvanie > 0) {
				casKonca = playTimeStart + superObj.superRow.trvanie*1000;
				casKoncaTrvanie = playTimeStart + superObj.superRow.trvanie*1000;
			}
			
			if (superObj.superRow.koniec_timezone  && materialObj.etestType != ETestUtils.etestTypeHomework) {
				casKonca = casKonca 
							? Math.min(casKonca, Date.fromDbString(superObj.superRow.koniec_timezone).getTime())
							: Date.fromDbString(superObj.superRow.koniec_timezone).getTime();
			}
		
	    	if (EdubarUtils.isStudentOrParent() && opts.superRow && opts.superRow.students_hidden*1 > 0) {
				createWaitingInfo({title: ls(8972)});
			} else 
	    	if (materialObj.getCardids().length == 0) {
	    		createEmptyInfo();	    	
	    	} else if (opts.mode == 'testCompetencesResults') {
	    		createContent(function() {
	    			evaluateAllCards();
	    			showResult();
					
					if (opts.gotoQuestion || opts.gotoQuestion === 0) {
						screenWidget.setCurrentQuestion(opts.gotoQuestion);
						opts.gotoQuestion = null;
					}					
	    		});
			} else
			if (opts.showSecuredStartInfo) {
				showSecuredStartInfo();			
			} else 
			if (
				(
				  materialObj.etestType != ETestUtils.etestTypeHomework 
				  && !opts.hasRework 
				  && (
					  (getCurrentTime().format('Y-m-d H:i:s') > superObj.superRow.koniec_timezone && superObj.superRow.koniec_timezone)
						|| (getCurrentTime().format('Y-m-d H:i:s') < superObj.superRow.zaciatok_timezone && superObj.superRow.zaciatok_timezone)
					  ) 
				)
				|| (superObj.superRow.max_pokusov && superObj.superRow.max_pokusov>0 && opts.pocetPokusov >= superObj.superRow.max_pokusov)
				) {
	    	
				createWaitingInfo();				
			} else if (casKonca && getCurrentTime() >= casKonca) {				
				createWaitingInfo();							
	    	} else if (opts.forceWaiting) {
				createWaitingInfo();
			} else			
	    	if (EdubarUtils.isRodic() && !isFinished && !isSecureMode() && !isTestMeMode()) {
				createPlayAsParentInfo();	
	    	} else {	   				 	 	
	    		createContent();
			}
			
			
	    }
	    
	    function initPlayData() {
	    	cardWidgetsWithAnswers = materialObj.getCardsWithAnswers();
		  	cardWidgets = materialObj.getCardWidgets();		  			  	
	    }
	    
	    function createContent(doneFunc) {
			isWaiting = false;
	    	var returnElem = mainElem.closest('.etest-return-div');	     	
	    	if (returnElem.length == 0) {
	    		barToggleEdubarHeader(false);
	    		barToggleSideBar(false);
	    	}    
	    	
	    	mainElem.html('');
	    	mainElem.toggleClass('etest-player',true);
			if (opts.mode == 'testCompetencesResults' && opts.mode2 == 'testMe') {
				mainElem.toggleClass('etest-player-testmeresults',true);
			}
	    	
			mainElem.toggleClass('cardsPerScreen-'+materialObj.getScreenProp('cardsPerScreen'), true);
			if (opts.bbMode) {
				mainElem.toggleClass('bbMode', true);
				mainElem.toggleClass('bbMode-'+et(opts.bbMode), true);
			}
			if (isContestMode()) {
				mainElem.toggleClass('contestMode', true);
			}
	    	
	    	headerElem = $('<div class="etest-player-header fixedLeft fixedRight"></div>').appendTo(mainElem);
	    	
	    	contentElem = $('<div class="etest-player-content"></div>').appendTo(mainElem);    	///etest-screen-container nedavame to tam, blbne to na safari
	    	
	    	sideElem = $('<div class="etest-player-sideoverlay" style="display: '+et(sideElemShown ? '' : 'none')+'"></div>').appendTo(mainElem);
	    	wndEnforcementElem = null;
			if (isWindowEnforcedMode()) {
				wndEnforcementElem = $('<div class="etest-player-wndenf-outer"></div>').appendTo(mainElem); 
				createWndEnforcementElem();
			}
	    	createHeader();
	    	    	
	    		
	    	$(document).off('webkitfullscreenchange.etestaplayer mozfullscreenchange.etestaplayer fullscreenchange.etestaplayer');
	    	$(document).on('webkitfullscreenchange.etestaplayer mozfullscreenchange.etestaplayer fullscreenchange.etestaplayer', function(e) {	    
	    		fullScreenChangeHandle(e);		    		
			});	    
			
			if (!MobileAppBridge.isActive()) {
				$(window).off('beforeunload.etestplayer');
				$(window).on('beforeunload.etestplayer', function(event) {
										
					if (!canSimplyClosePlayer()) {		
															
						return ls(8328);
					}
							
				});
			}
	    	mainElem.off('remove.etestplayer');
			
	    	mainElem.on('remove.etestplayer',function() {
				$(window).off('beforeunload.etestplayer');
				contentElem.scrollParent().off('scroll.etestplayer');
				$(document).off('webkitfullscreenchange.etestaplayer mozfullscreenchange.etestaplayer fullscreenchange.etestaplayer');
				removeAnswerLogEvents();
				if (playTimeInterval) clearInterval(playTimeInterval);
				if (autosaveTimeout) clearTimeout(autosaveTimeout);
				if (_confirmCloseDlg) {					
					barCloseDialog(_confirmCloseDlg);					
				}
				if (broadcastChannel) {
					broadcastChannel.close();
				}
	    	});	

			contentElem.scrollParent().off('scroll.etestplayer');
			contentElem.scrollParent().on('scroll.etestplayer', function() {
				handleScroll();
			});
	    	
	    	returnElem.data('checkChangesFunc',function() {
	    		
				
				if (!canSimplyClosePlayer()) {
					return confirm(ls(8328));
				} else {
					return true;
				}
			});



			
			createPlayContent(doneFunc);	   

			if (isWindowEnforcedMode() 
				&& (localStorage.getItem(getLocalStorageKey()+'wndblur') 
					|| (!isFinished && opts.vysledokRow && !opts.vysledokRow.firsttime && opts.playTimeStart && materialObj.getAllAnswerWidgets().length > 0 && isWindowEnforcedMode()))) {
				setWndBlurredState(true);
				handleWindowEnforcement();
			}
	    }

		function handleScroll() {
			if (!headerElem) return;
			contentElem.scrollParent().scrollTop();
			headerElem.find('.etest-player-header-inner').toggleClass('scroll0', contentElem.scrollParent().scrollTop() <=5);
		}
	    function showSecuredStartInfo() {
			var isWrongTime = false;
			if (opts.serverUtcTime) {				
				var cd = (new Date());
				var t = cd.getTime()+cd.getTimezoneOffset()*60*1000;
				var rozdiel = Date.fromDbString(opts.serverUtcTime).getTime() - t;  				
				isWrongTime = Math.abs(rozdiel)>2*60*1000;			
			}

			var s = '';
	    	
	    	s += '<div class="etest-playparent-outer">';
	    		s += '<div class="etest-playparent-inner">';
	    			s += '<div class="etest-playparent-inner3" style="padding: 25px">';
	    				s += '<img src="/elearning/pics/intro/dvaja-ucitelia.png" alt="" style="width: 100%;">';
	    			s += '</div>';
					s += '<div class="etest-playparent-inner2">';

						s += '<h1 style="font-size:32px;margin: 0 0 15px 0">{#10308}</h1>';
						
						s += '<div style="margin: 15px 0;color: #E53935;">';	    			
							s += '<b>{#2315}: </b>';
							
							if (superObj.superRow.max_pokusov && superObj.superRow.max_pokusov == 1) {
								s += '{#10305}';
							} else {
								s += '{#10476}';
							}

							if (isWindowEnforcedMode()) {
								s += '<div style="margin: 5px 0">';
									s += lset(14896);
								s += '</div>';
								s += '<div style="margin: 5px 0">';								
									s += '<b>'+lset(14897)+'</b>';
								s += '</div>';
							}
							
							
							if (EdubarUtils.isParent()) {
								s += '<div style="margin: 5px 0">';
									s += '{#8329}. <b>{#8332}</b>';
								s += '</div>';
							}

							
						s += '</div>';
						
						
						if (superObj.superRow.max_pokusov && superObj.superRow.max_pokusov>1) {
							s += '<div style="margin-bottom: 15px">';
								s += '{#8338}: <b>{maxPokusov}</b><br> {#8339}: <b>{pokusCislo}</b>';
							s += '</div>';							
						} 

						if (superObj.superRow.koniec_timezone || superObj.superRow.zaciatok_timezone) {
							s += '<div>';
								s += '{#8340}: ';
							s += '</div>';
							s += '<div style="padding:5px 15px">';
								if (superObj.superRow.koniec_timezone) {
									s += '<span style="display:inline-block;width:50px;text-align:'+ertl('right','left')+';">{#4636}:</span> <b>{startTime}</b><br>';
								}
								if (superObj.superRow.koniec_timezone) {
									s += '<span style="display:inline-block;width:50px;text-align:'+ertl('right','left')+';">{#1886}:</span> <b>{endTime}</b>';
								}
							s+= '</div>';
							
						}
						if (superObj.superRow.trvanie) {
							s += '<div>';
								s += '{#10291}: <b>'+(superObj.superRow.trvanie/60)+ ' {#9466}</b>';
								if (superObj.superRow.koniec_timezone) {
									s += ' ({#10307}: <b>{endTime}</b>)';
								}
							s += '</div>';
						}
						
						if (isWrongTime) {
							s += '<div style="margin: 25px 0">';
								s += '<div style="color:#E53935">';
									s += '<b>{#2315}: </b> {#10618}';																		
								s += '</div>';
								s += '<div style="margin-top:15px;text-align:'+ertl('right','left')+'">';
									s += '<a class="flat-button flat-button-bigger flat-button-red withShadow reloadPlayerBtn">{#10620}</a>';
								s += '</div>';
							s += '</div>';
						}
						 
						if (EdubarUtils.isParent()) {						
							s += '<div style="margin: 25px 0">';
								s += '<a class="flat-button flat-button-bigger flat-button-greenm withShadow playAsBtn">{#8331} {studentMeno}</a>';
							s += '</div>';
						} else {
							s += '<div style="margin: 25px 0">';
								s += '<a class="flat-button flat-button-bigger flat-button-greenm withShadow playAsBtn">{#10306}</a>';
							s += '</div>';
						}
						
						s += '<div style="margin-top:30px">';
							s += '<a class="ecourse-link-button cancelBtn" style="color:inherit" >';
								
									s += '<b>{#1038}</b>';			    			
							s += '</a>';	    			 	
						s += '</div>';
	    			s += '</div>';	
	    			
    			 	
	    		s += '</div>';
	    	s += '</div>';
	    	
	    	
	    	s = renderS(s, {
					studentMeno: opts.studentMeno,
					startTime: Date.fromDbString(superObj.superRow.zaciatok_timezone).format('d. M Y H:i'),
					endTime:  Date.fromDbString(superObj.superRow.koniec_timezone).format('d. M Y H:i'),
					maxPokusov: superObj.superRow.max_pokusov,
					pokusCislo: opts.pocetPokusov*1 == 0 ? '1' : opts.pocetPokusov*1+1,
	    		});
	    	mainElem.html(s);
	    	
	    	mainElem.find('.playAsBtn').on('click',function() {
				if (isSecureMode()) {
					if (isWindowEnforcedMode() && !fullScreenElement()) {
						actionFuncs.launchFullScreen();						
					}
					opts.securedStart = '1';
					reload();
					
				} else {
					createContent();
				}
	    	});
	    	
	    	mainElem.find('.cancelBtn').on('click',function() {
	    		actionFuncs.close(true);
	    	});

			mainElem.find('.reloadPlayerBtn').on('click',function() {
				reload();
			});
	    	
	    	
	    	mainElem.find('.etest-custom-checkbox').etestCustomCheckbox({});	
		}


		function isSecureMode() {
			return superObj && superObj.superRow && superObj.superRow.moredata && superObj.superRow.moredata.secure_mode == '1'
		}
		function isWindowEnforcedMode() {
			if (isFinished) return false;
			return superObj && superObj.superRow && superObj.superRow.moredata && superObj.superRow.moredata.wnd_enforcement == '1'			
		}

	    function createPlayAsParentInfo() {
	    	
	    	var s = '';
	    	
	    	s += '<div class="etest-playparent-outer">';
	    		s += '<div class="etest-playparent-inner">';
	    			s += '<div class="etest-playparent-inner3" style="padding: 25px">';
	    				s += '<img src="/elearning/pics/intro/dvaja-ucitelia.png" alt="" style="width: 100%;">';
	    			s += '</div>';
	    			s += '<div class="etest-playparent-inner2">';
	    				s += '<div style="opacity: 0.7;margin-bottom: 10px;">';	    			
		    			s += '<b>{#2315}:</b> {#8329}';
		    			s += '</div>';
		    			
		    			
		    			
		    			s += '<h2 style="font-size:32px;margin: 0 0 15px 0">{#8330}</h2>';
		    		
		    			s += '<div class="etest-playparent-btn playAsBtn" data-as="student" style="border-bottom: 1px dashed rgba(0,0,0,0.1)">';
		    				s += '<i class="material-icons">&#xE80C;</i>';
		    				s += '<div style="color:#0091EA">';
		    					s += '<b>{#8331} {studentMeno}</b>';
		    				s += '</div>';
		    				
		    				s += '<div style="opacity: 0.6;font-size:13px;">';
		    					s += '{#8332}';
		    				s += '</div>';
		    			s += '</div>'; 
		    			
		    			s += '<div  class="etest-playparent-btn " data-as="parent" style="opacity: 0.5">';
		    				s += '<i class="material-icons">&#xE7E9;</i>';
		    				s += '<div style="color:#0091EA">';
		    					s += '<b>{#8333}</b>';
		    				s += '</div>';
		    				s += '<div style="opacity: 0.6;font-size:13px;">';
		    					s += '{#8334}';
		    					s += '<br><br>{#7341}';
		    				s += '</div>';
		    			s += '</div>';
		    			
		    			
		    			s += '<div class="etest-playparent-btn cancelBtn" style="border-top: 1px dashed rgba(0,0,0,0.1)">';
		    					s += '<div style="text-transform: uppercase">';
			    					s += '<b>{#1038}</b>';
			    				s += '</div>';
		    			s += '</div>';	    			 	
	    			s += '</div>';	
	    			
    			 	
	    		s += '</div>';
	    	s += '</div>';
	    	
	    	
	    	s = renderS(s, {
					studentMeno: opts.studentMeno,
					startTime: Date.fromDbString(superObj.superRow.zaciatok_timezone).format('d. M Y H:i'),
					endTime:  Date.fromDbString(superObj.superRow.koniec_timezone).format('d. M Y H:i'),
					maxPokusov: superObj.superRow.max_pokusov,
	    		});
	    	mainElem.html(s);
	    	
	    	mainElem.find('.playAsBtn').click(function() {
				if (isSecureMode()) {
					opts.securedStart = '1';
					reload();
				} else {
					createContent();
				}
	    	}).keypressToClick();
	    	
	    	mainElem.find('.cancelBtn').click(function() {
	    		actionFuncs.close(true);
	    	}).keypressToClick();
	    	
	    	
	    	mainElem.find('.etest-custom-checkbox').etestCustomCheckbox({});	    	
	    }
	    
	     function createEmptyInfo() {
	    	var s = '';
	    	s += '<div class="etest-playparent-outer" style="height: 100vh;">';
	    		s += '<div class="etest-playparent-inner">';
	    			s += '<div class="etest-playparent-inner3" style="padding: 0 25px;align-self:center;text-align:center;">';
	    				
		    			s += '<span style="font-size:80px;opacity: 0.5">:(</span>';	
	    			s += '</div>';
	    			s += '<div class="etest-playparent-inner2">';
	    				
		    				s += '<div style="opacity: 0.7;margin-bottom: 10px;">';	    			
			    			s += '{testName}';
			    			s += '</div>';
		    				s += '<div>';
		    					s += '{#8335}';
		    				s += '</div>';
	    			 		
	    			 		
	    			 		s += '<div style="text-align: '+ertl('left','right')+';margin-top:25px;">';
		    				s += '<a class="flat-button flat-button-graym cancelBtn" style="padding: 10px 20px;">';
		    					s += '{#1567}';
		    				s += '</a> ';		
		    				
		    				
		    			s += '</div>';
	    			s += '</div>';	
	    			    			 	
	    		s += '</div>';
	    	s += '</div>';
	    	
	    	s = renderS(s, {	    			
	    			testName: materialObj.materialData.name
	    		});
	    	mainElem.html(s);
	    	
	    	mainElem.find('.cancelBtn').click(function() {
	    		actionFuncs.close(true);
	    	});
	    }
	    	
	    	
	    
	    
	    function createWaitingInfo(options) {
			var showRestore = true;
	    	var s = '';
	    	s += '<div class="etest-playparent-outer">';
	    		s += '<div class="etest-playparent-inner">';
	    			s += '<div class="etest-playparent-inner3" style="padding: 0 25px;align-self:center;">';
	    				
		    			s += '<div style="width:250px;margin: 0 0 0 auto">';
							s += '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" class="etest-clock" style="width:100%;max-width:250px;">';
								s += '<filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/> <feOffset in="blur" dx="2.5" dy="2.5"/></filter>';
								s += '<g>';
									s += '<circle style="fill:rgba(0,0,0,0.1)" cx="128" cy="125" r="117" filter="url(#innerShadow)"></circle>';
									s += '<circle style="stroke: #334960; fill: #7e8c8d;stroke-width:12px" cx="125" cy="125" r="110"/>';
									s += '<line x1="125" y1="35"  x2="125" y2="25"/>';
									s += '<line x1="175" y1="38"  x2="170" y2="47"/>';
									s += '<line x1="212" y1="75"  x2="203" y2="80"/>';
									s += '<line x1="215" y1="125" x2="225" y2="125"/>';
									s += '<line x1="212" y1="175" x2="203" y2="170"/>';
									s += '<line x1="175" y1="212" x2="170" y2="203"/>';
									s += '<line x1="125" y1="215" x2="125" y2="225"/>';
									s += '<line x1="75"  y1="212" x2="80"  y2="203"/>';
									s += '<line x1="38"  y1="175" x2="47"  y2="170"/>';
									s += '<line x1="25"   y1="125" x2="35"  y2="125"/>';
									s += '<line x1="38"  y1="75"  x2="47"  y2="80" />';
									s += '<line x1="75"  y1="38"  x2="80"  y2="47" />';
									
								s += '</g>';
								s += '<g>';
									s += '<line x1="125" y1="125" x2="125" y2="70" style="stroke-width: 6px; stroke: #fff;" class="hourhand"/>';
									s += '<line x1="125" y1="125" x2="125" y2="40" style="stroke-width: 4px; stroke: #fff;"  class="minutehand"/>';
									s += '<line x1="125" y1="125" x2="125" y2="30"  style="stroke-width: 2px; stroke: #fff;"   class="secondhand"/>';
									s += '<circle style="fill:#2d3e52; stroke: #95a5a5; stroke-width: 2px;" cx="125" cy="125" r="5"></circle>';
								s += '</g>';
							s += '</svg>'; 
						s += '</div>';
	    			s += '</div>';
	    			s += '<div class="etest-playparent-inner2">';
	    				
		    				s += '<div style="opacity: 0.7;margin-bottom: 10px;">';	   
							s += opts.playerName ? et(opts.playerName)+ ' Â· ' : ''; 			
			    			s += '{testName}';
							s += '</div>';
						if (options && options.title) {
							s += '<h2 style="font-size:32px;margin: 0 0 15px 0">'+et(options.title)+'</h2>';
						} else 						
		    			if (superObj.superRow.max_pokusov && superObj.superRow.max_pokusov>0 && opts.pocetPokusov >= superObj.superRow.max_pokusov) {							
							s += '<h2 style="font-size:32px;margin: 0 0 15px 0">{#8336}</h2>';
						} else if (opts.resultMode) {							
							s += '<h2 style="font-size:32px;margin: 0 0 15px 0">'+et(opts.forceWaitingTitle ? opts.forceWaitingTitle : ls(10988))+'</h2>';
						} else if (opts.finishedtime) {
							s += '<h2 style="font-size:32px;margin: 0 0 15px 0">{#10294}</h2>';
						} else if (casKoncaTrvanie && getCurrentTime() > casKoncaTrvanie) {
							s += '<h2 style="font-size:32px;margin: 0 0 15px 0">{#10289}</h2>';						
		    			} else {
		    				s += '<h2 style="font-size:32px;margin: 0 0 15px 0">{#8337}</h2>';
		    			}
						s += '<div style="line-height: 1.5em;">';
						if (opts.playTimeStart) {
							s += '<div style="margin-bottom:15px">';
								s += '{#10290} <b>'+(ETestUtils.isNumeric(opts.playTimeStart) ? new Date(opts.playTimeStart*1000) : Date.fromDbString(opts.playTimeStart)).format('d.m.Y H:i:s')+'</b>';
								/*if (superObj.superRow.trvanie) {
									s += '<div>';
										s += '{#10291}: <b>'+(superObj.superRow.trvanie/60)+ ' min</b>'
									s += '</div>';
								}*/
							s += '</div>';
						}
						
		    			if (!opts.resultMode && superObj.superRow.max_pokusov && superObj.superRow.max_pokusov>0) {
		    				s += '<div style="margin-bottom: 15px">';
			    				s += '{#8338}: <b>{maxPokusov}</b><br> {#8339}: <b>{pokusCislo}</b>';
							s += '</div>';							
			    		}
						if (!opts.resultMode && superObj.superRow.trvanie) {
							s += '<div style="margin-bottom: 15px">';
								s += '{#10291}: <b>'+(superObj.superRow.trvanie/60)+ ' {#9466}</b>';
								if (superObj.superRow.koniec_timezone) {
									s += ' ({#10307}: <b>{endTime}</b>)';
								}
							s += '</div>';
						}
		    			if (!opts.resultMode && (superObj.superRow.koniec_timezone || superObj.superRow.zaciatok_timezone)) {
			    			s += '<div>';
			    				s += '{#8340}: ';
			    			s += '</div>';
							s += '<div style="padding:5px 15px">';
								if (superObj.superRow.zaciatok) {
									s += '<span style="display:inline-block;width:50px;text-align:'+ertl('right','left')+';">{#4636}:</span> <b>{startTime}</b><br>';
								}
								if (superObj.superRow.koniec) {
									s += '<span style="display:inline-block;width:50px;text-align:'+ertl('right','left')+';">{#1886}:</span> <b>{endTime}</b>';
								}
								
		    				s+= '</div>';
		    				
		    				if (superObj.superRow.zaciatok_timezone > getCurrentTime().format('Y-m-d H:i:s') && !(superObj.superRow.max_pokusov && superObj.superRow.max_pokusov>0 && opts.pocetPokusov >= superObj.superRow.max_pokusov)) {
		    					s += '<div style="margin-top:15px"><b>'+lset(8341)+'</b></div>';
		    				}  
		    			} 

		    			s += '</div>';
		    			s += '<div style="text-align: '+ertl('left','right')+';margin-top:25px;">';
		    				s += '<a class="flat-button flat-button-graym cancelBtn" style="padding: 10px 20px;">';
		    					s += '{#1567}';
		    				s += '</a> ';		
		    				
		    				if (opts.somPridelovac) {
		    					s += '<a class="flat-button flat-button-greenm forceContinueBtn" style="padding: 10px 20px;">';
			    					s += '{#8342}';
			    				s += '</a> ';
							}		
							if (showRestore) {
								s += renderS('<a class="etest-action-button actionButton {selected} ecourse-link-button" data-action="showLocalResults" data-fromwaiting="1" style="position: absolute;'+ertl('right','left')+':5px;top:5px;"><i class="material-icons" style="opacity:0.4;vertical-align:middle;width:1em;">history</i></a>', {
								
								});
							}
		    			s += '</div>';
	    			 	
	    			s += '</div>';	
	    			
    			 	
	    		s += '</div>';
	    	s += '</div>';
	    	
	    	s = renderS(s, {
	    			startTime: Date.fromDbString(superObj.superRow.zaciatok_timezone).format('d. M Y H:i'),
	    			endTime:  Date.fromDbString(superObj.superRow.koniec_timezone).format('d. M Y H:i'),
	    			maxPokusov: superObj.superRow.max_pokusov,
	    			pokusCislo: opts.pocetPokusov*1 == 0 ? '1' : opts.pocetPokusov*1/*+1*/,
	    			testName: materialObj.materialData.name
	    		});
	    	mainElem.html(s);
	    	
	    	mainElem.find('.cancelBtn').click(function() {
	    		actionFuncs.close(true);
	    	});
	    	
	    	mainElem.find('.forceContinueBtn').click(function() {
	    		superObj.superRow.koniec_timezone = '';
	    		createContent();
	    	});
			
			
			mainElem.find('.etest-action-button').on('click',function(event) {
				handleActionButton(this, event);	 			
			}); 		 	
	    	
	    	var clock = mainElem.find('.etest-clock');
	    	var secondhand = clock.find('.secondhand');
	    	var minutehand = clock.find('.minutehand');
	    	var hourhand = clock.find('.hourhand');
	    	
	    	 
		    function getX(degrees, r, adjust, x) {
				var x = x || r, 
				adj = adjust || 1;
				return x + r * adj * Math.cos(getRad(degrees));
		    }
		
		       
		    function getY(degrees, r, adjust, y) {
				var y = y || r,
				adj = adjust || 1;
				return y + r * adj * Math.sin(getRad(degrees));
		    }
				    
		    function getRad(degrees) {
				var adjust = Math.PI / 2;
				return (degrees * Math.PI / 180) - adjust;
		    }
		    
	    	 var drawHands = function() {				
				var SECONDS_HAND_SIZE = 0.95,
				MINUTES_HAND_SIZE = 0.85,
				HOURS_HAND_SIZE = 0.55;
			
				
			
				// Clock Circle's Properties
				var r = 100,
				cx = 125,
				cy = 125;
			
				// Current time.
				var currentTime = getCurrentTime();
			
				// Draw Hands
				drawHand(secondhand.get(0),
					 currentTime.getSeconds(),
					 SECONDS_HAND_SIZE,
					 6);
				drawHand(minutehand.get(0),
					 currentTime.getMinutes(),
					 MINUTES_HAND_SIZE,
					 6);
				drawHand(hourhand.get(0),
					 currentTime.getHours()*5+(currentTime.getMinutes()/60)*5,
					 HOURS_HAND_SIZE,
					 6);
				
				function drawHand(hand, value, size, degrees) {
				    var deg = degrees * value;
				    x2 = getX(deg, r, size, cx),
				    y2 = getY(deg, r, size, cy);
				    
				    hand.setAttribute('x1', cx);
				    hand.setAttribute('y1', cy); 
				    hand.setAttribute('x2', x2);
				    hand.setAttribute('y2', y2); 
				}
			};
			
			drawHands();
			var clockInterval = setInterval(function() {
				drawHands();
				if (!opts.resultMode 
					&& superObj.superRow.zaciatok_timezone <= getCurrentTime().format('Y-m-d H:i:s') 
					&& superObj.superRow.koniec_timezone >= getCurrentTime().format('Y-m-d H:i:s') 
					&& getCurrentTime() < casKonca
					&& !(superObj.superRow.max_pokusov && superObj.superRow.max_pokusov>0 && opts.pocetPokusov >= superObj.superRow.max_pokusov)) {
					
					reloadAfterWaiting();
					clearInterval(clockInterval);
				}
				
			}, 500);
			
			clock.on('remove',function() {				
				clearInterval(clockInterval);
			});
			
	    }
	    
	    function getCardsData(cardids, doneFunc) {	
			
			ETestUtils.getCardsData(cardids, function() {
				if (loadingElem) loadingElem.hide();
				cardsData = ETestUtils.cardsData;
				doneFunc();
			});		
		}
	    
	    function scanForInteractiveElements(elem) {
	    	if (!elem) elem = mainElem;    	
	    	elem.find('.interactiveElem').each(function() {
	    		interactiveElems[$(this).attr('data-elemid')] = $(this);
	    	});
		}
		
		function isContestMode() {
			return opts.mode == 'contest';
		}

		function isTestMeMode() {			
			return /*materialObj && materialObj.isTestMeMode() &&*/ opts.mode2 == 'testMe';
		}

		function isTestMeCardsMode() {			
			return materialObj && materialObj.isTestMeMode() && opts.mode2 == 'testMe';
		}

		function isTestMePlayTestMode() {			
			return opts.mode2 == 'testMe' && !(materialObj && materialObj.isTestMeMode());
		}
	    
		function createWndEnforcementElem() {
			var s = '';
			s += '<div class="etest-player-wndenf-inner">';
				s += '<div>';
						s += '<i class="fa fa-fw fa-warning warningIcon"></i>';
				s += '</div>';
				s += '<div style="margin:24px;font-size: 1.5em">';
					s += '<b>{#14894}</b>'
				s += '</div>';
				s += '<div style="margin:24px">';
					s += lset(14895);
				s += '</div>';
				s += '<div>';
					s += '<button type="button" class="flat-button flat-button-gray flat-button-bigger withShadow continueBtn" disabled>{#8346}</button>';					
				s += '</div>';
			s += '</div>';
			
			wndEnforcementElem.html(renderS(s));				
			wndEnforcementElem.find('.continueBtn').on('click',function() {				
				
				if (this.disabled) return;
				if (!fullScreenElement()) actionFuncs.launchFullScreen();
				mainElem.toggleClass('wnd_blurred',false);
				isBlurredCurrently = false;
				setWndBlurredState(false);
			});

			/*wndEnforcementElem.find('.continueBtn2').on('click',function() {					
				//s += '<button type="button" class="flat-button flat-button-blue flat-button-bigger withShadow continueBtn2" >Pokracovat2</button>';
				if (!fullScreenElement()) actionFuncs.launchFullScreen();
				mainElem.toggleClass('wnd_blurred',false);
				isBlurredCurrently = false;
				setWndBlurredState(false);	
			});*/
		}

		var _wndBlurTimeout = null;
		var _wndCanReactivateTimeout = null;
		var wndBlurredReactivateTime = null;
		var isBlurredCurrently = false;
		var blurredCanReactivateAfterSeconds = 20;
		function setWndBlurredState(val) {
			mainElem.toggleClass('wnd_blurred',!!val);
			isBlurredCurrently = val;
			if (val) {
				localStorage.setItem(getLocalStorageKey()+'wndblur',val ? '1' : '0');
			} else {
				localStorage.removeItem(getLocalStorageKey()+'wndblur');
			}
			addAnswerLogEvent(mainElem.get(0), val ? 'PLAYER_BLURRED' : 'PLAYER_ACTIVE');
		}
		function handleWindowEnforcement() {
			if (!isWindowEnforcedMode()) return;
			
			if (isFinished) return;		
			if (!wndEnforcementElem) return;
			var isBlurred = false;
			var isBlurred0 = false;
			var isFullScreenBlurOnly = false;
			if (!fullScreenElement()) {
				isBlurred = true;
				isFullScreenBlurOnly = true;
			}
			if (!document.hasFocus() || document.hidden) {
				isBlurred = true;
				isBlurred0 = true;
				isFullScreenBlurOnly = false;
			}

			

			var btnElem = wndEnforcementElem.find('.continueBtn');
			if (_wndBlurTimeout) clearTimeout(_wndBlurTimeout);
			if (isBlurred && !isBlurredCurrently) {
				_wndBlurTimeout = setTimeout(function() {
					
					setWndBlurredState(isBlurred);	
					
					_wndBlurTimeout = null;					

					btnElem.toggleClass('flat-button-red', false).toggleClass('flat-button-gray',true);
					btnElem.html(lset(8346)+' ('+blurredCanReactivateAfterSeconds+')');
					btnElem.attr('disabled',true);
					if (document.hasFocus()) {
						wndBlurredReactivateTime = Date.now() + (isFullScreenBlurOnly ? 100 : blurredCanReactivateAfterSeconds*1000);
						startWindowBlurredTimer();
					}
				},700);
			} else
			if (isBlurredCurrently && !isBlurred0) {
				wndBlurredReactivateTime = Date.now() + blurredCanReactivateAfterSeconds*1000;
				startWindowBlurredTimer();
			} else
			if (isBlurredCurrently && isBlurred0) {
				if (_wndCanReactivateTimeout) clearTimeout(_wndCanReactivateTimeout);
				btnElem.toggleClass('flat-button-red', false).toggleClass('flat-button-gray',true);
				btnElem.html(lset(8346)+' ('+blurredCanReactivateAfterSeconds+')');
				btnElem.attr('disabled',true);
			}			
		}
		function canReactivateBlurredWindow() {
			if (!wndBlurredReactivateTime) return true;
			if (Date.now() > wndBlurredReactivateTime) return true;
			return false;
		}
		function startWindowBlurredTimer() {
			if (_wndCanReactivateTimeout) clearTimeout(_wndCanReactivateTimeout);
			var canReactivate = canReactivateBlurredWindow();
			var btnElem = wndEnforcementElem.find('.continueBtn');
			btnElem.toggleClass('flat-button-red', canReactivate).toggleClass('flat-button-gray',!canReactivate)

			var remainingSeconds = canReactivate ? 0 : Math.ceil((wndBlurredReactivateTime - Date.now())/1000);
			btnElem.html(lset(8346)+et(remainingSeconds > 0 ? ' ('+remainingSeconds+')' : ''));
			btnElem.attr('disabled', !canReactivate);
			if (canReactivate) {
				wndBlurredReactivateTime = null;
			} else {
				_wndCanReactivateTimeout = setTimeout(function() {
					_wndCanReactivateTimeout = null;
					startWindowBlurredTimer();
				},300);
			}
		}

	    function createHeader() {
	    	
	    	var s = '';
	    	
	    	var showSlidesCounter = (cardWidgets.length != cardWidgetsWithAnswers.length && materialObj.getScreenProp('cardsPerScreen') == 'single');
	    	var showAnswersCounter = cardWidgetsWithAnswers.length > 0;
	  		
			s += '<div class="etest-player-header-inner scroll0" role="toolbar">';
			  	if (!isContestMode()) {
					s += '<div class="etest-header-nav">';
						s += '<a class="etest-action-button" data-action="playerClose" title="{#1567}" aria-label="{#1567}" tabindex="0" role="button"><i class="material-icons" aria-hidden="true">'+ertl('arrow_back', 'arrow_forward')+'</i></a>';				  		
					s += '</div>';
					if (isTestMeCardsMode() && (showSlidesCounter || showAnswersCounter) && opts.mode != 'testCompetencesResults') {
						s += '<div class="etest-player-title-question-num etest-action-button" data-action="playerClose" tabindex="0" role="button">';
							s += '<span class="interactiveElem" data-elemid="currentCardElem">';
								s += '1';
							s += '</span>';								
						s += '</div>';
					} else
					if (!isTestMeCardsMode() && (showSlidesCounter || showAnswersCounter)) {
						s += '<div class="etest-player-title-name counters{countersCount}">';  	
							if (showSlidesCounter) {			  						
								s += '<div style="white-space:nowrap;" title="{#11792}">';
									
									s += '<i class="fa fa-fw fa-desktop desc-icon" style="margin-'+ertl('left','right')+':0" aria-hidden="true"></i>';
									s += '<span class="sr-only">{#11792}:</span>';
									s += '<span class="interactiveElem" data-elemid="currentCardElem">';
										s += '1 / '+cardWidgets.length;
									s += '</span>';
								s += '</div>';
							} 
							
							if (showAnswersCounter) {
								s += '<div style="white-space:nowrap;" title="{#11793} / {#11794}">';  												
									s += '<i class="fa fa-fw fa-check-square-o desc-icon" style="margin-'+ertl('left','right')+':0"></i>';
									s += '<span class="sr-only">{#11793} / {#11794}:</span>';
									s += '<span class="interactiveElem" data-elemid="answeredQuestionsElem">';
										s += '0 / 0';
									s += '</span>';
								s += '</div>';
							}
						
						s += '</div>';
					}
				}
				if (isTestMeCardsMode()) {
					s += '<div class="etest-player-title-questionbar"></div>';
				} else if (opts.odovzdavanieMode && superObj.superRow.koniec_timezone) {
					s += '<div class="etest-player-title-time" style="text-align: center;padding-left:109px;" role="timer" title="{#6375}">';
						//s += '<i class="fa fa-fw fa-clock-o desc-icon" aria-hidden="true"></i>';
						
						s += '<div style="font-weight:normal;font-size:0.85em;opacity: 0.5">{#4016}:</div>';
						s += '<span >';
							s += Date.fromDbString(superObj.superRow.koniec_timezone).format('d.m.Y H:i') ;
						s += '</span>';
						
					s += '</div>';
				} else {
					s += '<div class="etest-player-title-time" style="visibility: hidden" role="timer" title="{#6375}">';
						s += '<i class="fa fa-fw fa-clock-o desc-icon" aria-hidden="true"></i>';
						s += '<span class="sr-only">{#6375}:</span>';
						s += '<span class="interactiveElem" data-elemid="timeElem">';
							s += '00:00';
						s += '</span>';
					s += '</div>';
				}

				if (isContestMode() && materialObj && materialObj.materialData && materialObj.materialData.materialTitle) {
					s += '<div class="etest-player-title-name-c">';  	
						s+= et(materialObj.materialData.materialTitle);
					s += '</div>';
				}

	  			if (cardWidgetsWithAnswers.length > 0 && !isTestMeCardsMode() && !opts.odovzdavanieMode) {
		  			s += '<div class="etest-player-title-score">';
						if (superObj.zobrazovatSkore('l1') && superObj.zobrazovatSpravne('l1')) {
							s += '<span class="sr-only">{#8318} (%)</span>';
							s += '<span class="interactiveElem" data-elemid="scorePercentElem" title="{#8318} (%)" style="vertical-align:middle">';				
							s += '0';
							s += '</span>';
							
							s += '<i class="fa fa-fw fa-percent desc-icon" style="margin:0"></i>';
						}
		  			s += '</div>';
		  		}
		  		
				  s += '<div class="etest-header-nav">';
					if (EdubarUtils.isUcitel() && EdubarUtils.isBBEnabled()) {
						s += '<a class="etest-action-button" data-action="openBlackboard"  tabindex="0" role="button" title="{#9285}" aria-label="{#9285}"><i class="material-icons" aria-hidden="true" style="vertical-align:middle;font-size:24px;width:24px;">cast</i></a>';
					}
		  			if (!MobileAppBridge.isActive() && !isWindowEnforcedMode()) {
		  				s += '<a class="etest-action-button interactiveElem" data-elemid="fullScreenBtn" data-action="launchFullScreen" tabindex="0" role="button" title="{#11797}" aria-label="{#11797}"><i class="material-icons interactiveElem" aria-hidden="true" data-elemid="fullScreenIcon" style="vertical-align:middle;font-size:24px;">&#xE5D0;</i></a>';
					}
					
					  
					s += '<a class="etest-action-button" data-action="openSideMenu" tabindex="0" role="button" title="{#8130}" aria-label="{#8130}"><i class="material-icons" aria-hidden="true">more_vert</i></a>';				  		
				s += '</div>';
	  		s += '</div>';
	  		  
	  		s += '<div class="etest-loading-indicator">';			
				s += '<div class="etest-loading-line"></div>';
				s += '<div class="etest-loading-subline etest-loading-inc"></div>';
				s += '<div class="etest-loading-subline etest-loading-dec"></div>';
			s += '</div>';	
			
			s = renderS(s, {
					countersCount: showSlidesCounter && showAnswersCounter ? 2 : 1
				});
	  		headerElem.html(s);
	  		
	 		
	 		loadingElem = headerElem.find('.etest-loading-indicator'); 
	 		
	 		initActionButtons(headerElem.find('.etest-action-button'));
	 		
	 		scanForInteractiveElements(headerElem);	
	 		
	 		
			headerElem.hover(function() {
			
				$(this).toggleClass('hovered', true);
				headerHovered = true;
			}, function() {
				if (headerHoverTimeout) {
					clearTimeout(headerHoverTimeout);
				}
				var that = this;
				
				setTimeout(function() {
					$(that).toggleClass('hovered', false);
					headerHoverTimeout = null;
					headerHovered = false;
				}, 1500);
				
			})
	 		
	 		initializeTime();
	    }
	    
	    function handleActionButton(elem, event) {
	    	return ETestUtils.handleActionButton(elem, actionFuncs, event);
	    }

		function initActionButtons(elems) {
			elems.on('click',function(event) {
				if ($(this).closest('.etest-player-sidebar').length > 0) {
					toggleSideElem();
				}
				handleActionButton(this, event);	 			
			}).on('keypress',function(event) {
			   if (event.which == 13 || event.which == 32) {
				   event.preventDefault();
				   if ($(this).closest('.etest-player-sidebar').length > 0) {
						toggleSideElem();
					}
				   handleActionButton(this, event);	 			
			   }
		   }); 
		}
	    
	    function createSideElem(cardWidgets) {
	    	var s = '';
	    	 
	    	s += '<div class="etest-player-sidebar fixedRight fixedTop" role="dialog" aria-modal="true">';
	    	 
				  s += '<div class="etest-player-sidebar-toolbar etest-header-nav">';
				  
					/*var localResults = getLocalStorageResults();
					if (localResults.length > 0) {*/
					if (opts.localAutosave !== false && !isTestMeMode()) {
						s += renderS('<a class="etest-action-button actionButton {selected}" data-action="showLocalResults" style="position: absolute;'+ertl('left','right')+':0;top:0;" title="{#11790}" aria-label="{#11790}"><i class="material-icons" aria-hidden="true" style="opacity:0.4;vertical-align:middle;width:1em;" aria-hidden="true">history</i></a>', {
							
						 	});
					}
					//}
					if (!isContestMode() && !materialObj.isSecured && !isTestMeMode()) {
						s += renderS('<a class="etest-action-button actionButton {selected}" data-action="switchScreenMode" tabindex="0"  data-mode="single" title="{#8344}" aria-label="{#8344}" role="button"><i class="material-icons" aria-hidden="true" style="vertical-align:middle">&#xE41B;</i></a>', {
								selected: screenWidget.props.cardsPerScreen == 'single' ? 'selected' : ''
							});
						s += renderS('<a class="etest-action-button actionButton {selected}" data-action="switchScreenMode" tabindex="0"  role="button" data-mode="all" title="{#8345}" aria-label="{#8344}" style="margin-'+ertl('right','left')+': 25px"><i class="material-icons" aria-hidden="true" style="vertical-align:middle">&#xE8F2;</i></a>', {
								selected: screenWidget.props.cardsPerScreen != 'single' ? 'selected' : ''
							});
						}
	    	 	 	
	    	 	 	s += '<a class="etest-action-button actionButton hideSideElemBtn" data-action="openSideMenu" title="{#11789}"  role="button" aria-label="{#11789}" tabindex=0"><i class="fa fa-fw fa-close" aria-hidden="true"></i></a>';
	    	 	 s += '</div>';
		    	 s += '<div class="etest-player-sidber-inner">';
		    	 	s += '<div class="etest-player-sidebar-actions">';
						if (isFinished) {
							if (isTestMeMode() && opts.testmeAgainFunc) {
								s += '<a class="flat-button flat-button-green actionButton" data-action="testMeAgain" tabindex="0" role="button"><i class="fa fa-repeat fa-fw" aria-hidden="true"></i><span>{#8354}</span></a>';							
							}

							s += '<a class="flat-button flat-button-graym actionButton" data-action="playerClose" tabindex="0" role="button"><i class="fa fa-power-off fa-fw" aria-hidden="true"></i><span>{#12701}</span></a>';							

							if (isTestMeMode()) {
								s += '<a style="margin-top:2em" class="flat-button flat-button-blue actionButton" data-action="resultExpandAll" tabindex="0" role="button"><i class="fa fa-angle-down fa-fw" aria-hidden="true"></i><span>{#4468}</span></a>';							
								s += '<a class="flat-button flat-button-blue actionButton" data-action="resultCollapseAll" tabindex="0" role="button"><i class="fa fa-angle-up fa-fw" aria-hidden="true"></i><span>{#8741}</span></a>';							
							}
							
						} else {

							if (isTestMeCardsMode()) {
								s += '<a class="flat-button flat-button-red actionButton" data-action="reportQuestion" tabindex="0" role="button" style="margin-bottom: 24px"><i class="fa fa-warning fa-fw" aria-hidden="true"></i><span>{#8659}</span></a>'	
							}
							
							s += '<a class="flat-button flat-button-greenm actionButton" data-action="openSideMenu" tabindex="0" role="button"><i class="fa fa-play fa-fw" aria-hidden="true"></i><span>{#8346}</span></a>'
						
							if (isTestMeCardsMode()) {
								//s += '<a class="flat-button flat-button-graym actionButton" data-action="playerClose" tabindex="0" role="button"><i class="fa fa-close fa-fw" aria-hidden="true"></i> {#1567}</a>';
							} else {
								if (opts.odovzdavanieMode) {
									s += '<a class="flat-button flat-button-blue actionButton" data-action="saveResult" tabindex="0" role="button"><i class="fa fa-save fa-fw" aria-hidden="true"></i><span>{#1529}</span></a>';
									s += '<a class="flat-button flat-button-graym actionButton" data-action="playerClose" tabindex="0" role="button"><i class="fa fa-power-off fa-fw" aria-hidden="true"></i><span>{#12701}</span></a>';
								} else {
									if (!opts.interactivePreviewMode) {
										s += '<a class="flat-button flat-button-red actionButton" data-action="submit" tabindex="0" role="button"><i class="fa fa-check-square-o fa-fw" aria-hidden="true"></i><span>{#8218}</span></a>';
									}

									if (!opts.onlySubmitMode) {
										if (ETestUtils.isProjectMode(materialObj.etestType) && !isTestMePlayTestMode()) {
											s += '<a class="flat-button flat-button-blue actionButton" data-action="saveResult" tabindex="0" role="button"><i class="fa fa-save fa-fw" aria-hidden="true"></i><span>{#1529}</span></a>';
										}
										
										if (!isTestMeMode()) {
											s += '<a class="flat-button flat-button-graym actionButton" data-action="playerClose" tabindex="0" role="button"><i class="fa fa-power-off fa-fw" aria-hidden="true"></i><span>{#12701}</span></a>';
										}
									}
								}
							}
							
							if (materialObj.isTestMeMode()) {
								s += '<a class="flat-button flat-button-blue actionButton answerAgainBtn" data-action="answerQuestionAgain" style="margin-top: 15px" tabindex="0" role="button"><i class="fa fa-repeat fa-fw" aria-hidden="true"></i><span>{#8348}</span></a>';
							}
						}
		    	 	s += '<div>';


		    	 	if (!isTestMeCardsMode()) {
						s += '<div style="margin: 25px 0 10px 0;text-align:center"><b>{#9281}:</b></div>';
						s += '<div class="etest-player-sidebar-questions">';
							var variant = getVariantFlat(currentVariantid);
							var ind = 0;
							for (var i=0;i<variant.length;i++) {
								var v = variant[i];
								var w = cardWidgets[v.cardid];		
								if (!w) continue;		
								if (w.isVisible && !w.isVisible()) continue;					
								var aws = w.getAnswerWidgets();
								var ss = '';
								
								ss += '<div class="etest-player-sidebar-question {withAnswer} actionButton" data-action="gotoQuestion" tabindex="0" data-ind="{i}" role="{role}">';
									var s3 = '';		    	 	
									/*if (aws.length > 0) {
										s3 += '<i class="fa fa-check-square-o"></i>';
									}*/
									
									/*if (w.findByWidgetClass('HintETestWidget').length > 0) {
										s3 += '<i class="fa fa-question" aria-hidden="true"></i>';
									}
									
									if (w.findByWidgetClass('HintETestWidget').length > 0) {
										s3 += '<i class="fa fa-lightbulb-o" aria-hidden="true"></i>';
									}*/
									
									if (s3) {
										ss += '<div class="etest-player-sidebar-question-tags">'+s3+'</div>';
									}
									
									
									ss += '{ind}';

									ss += '<span class="sr-only aria-desc"></span>';
								ss += '</div>';
								
								s += renderS(ss, {
										ind: ind+1,
										i: i,
										withAnswer: aws.length > 0 ? 'withAnswer' : 'noAnswer',
										withSolution: w.findByWidgetClass('SolutionETestWidget').length > 0 ? 'withSolution' : '',
										withHint: w.findByWidgetClass('HintETestWidget').length > 0 ? 'withHint' : '',
										role: screenWidget.props.cardsPerScreen == 'single' ? 'button' : 'button'
									});

								ind++;
							}
							
							if (variant.length > 4) {
								for (var i=0;i<4;i++) {
									s += '<div style="flex: 20% 1 1; margin: 2px"></div>';
								}
							}
						s += '</div>';

						if (!isFinished && screenWidget 
							&& (screenWidget.props.cardsPerScreen == 'single' || screenWidget.props.playSound == 'yes')
							&& superObj.zobrazovatSpravne('l1')
							&& materialObj && materialObj.getAllAnswerWidgets().length > 0) {
							s += '<div style="position:absolute;bottom: 0;backgorund:inherit;text-align:center;padding: 12px 8px;">';
								var ss = '';
								ss += '<label class="etest-custom-checkbox {checked}" style="font-size:0.9em;opacity:0.7">';
									ss += '<input type="checkbox" name="playSound" value="1" {checked}>';
									ss += '<span >{#13950}</span>';
								ss += '</label>';
								s += renderS(ss, {checked: screenWidget.props.playSound == 'yes' ? 'checked' : ''});
							s += '</div>';
						}
					}
		    	 s += '</div>';		    	 
	    	s += '</div>';
	    	s = renderS(s, {});
	    	sideElem.html(s);
	    	 
	    	initActionButtons(sideElem.find('.actionButton'));
			
			sideElem.on('click',function(event) {
				if ($(event.target).closest('.etest-player-sidebar').length > 0) return;
				toggleSideElem();
			});
			
			validateSidebarCards();

			sideElem.find('.etest-custom-checkbox').etestCustomCheckbox({});

			sideElem.find('input[name="playSound"]').on('change',function() {
				screenWidget.props.playSound = this.checked ? 'yes' : '';
			})
		}
		
		function getVariantFlat(variantid) {
			return materialObj.getVariantFlat ? materialObj.getVariantFlat(variantid) : materialObj.getVariant(variantid);
		}
	    
	    function validateSidebarCards() {
	    	var variant = getVariantFlat(currentVariantid);
	    	sideElem.find('.etest-player-sidebar-question').each(function() {
	    		var ind = $(this).attr('data-ind')*1;
				$(this).toggleClass('current', materialObj.getScreenProp('cardsPerScreen') == 'single' && screenWidget.getCurrentQuestion() == ind);
				
				var qw = variant[ind] ? materialObj.getCardWidget(variant[ind].cardid) : null;
				if (qw) {
					$(this).toggleClass('isAnswered',!!qw.isAnswered() || qw.isEvaluated());				
				}

				var ariaStrs = [];
				if ($(this).hasClass('current')) {					
					ariaStrs.push(ls(11795));
					
				}

				$(this).attr('aria-selected', $(this).hasClass('current') ? 'true' : 'false');
				if (qw && qw.getAnswerWidgets().length > 0) {
					ariaStrs.push($(this).hasClass('isAnswered') ? ls(11796) : ls(8032));					
				}

				$(this).find('.aria-desc').html(et(ariaStrs.join(', ')));
			});
			
			if (materialObj.getScreenProp('cardsPerScreen') == 'single') {
				
				var qw = materialObj.getCardWidget(variant[screenWidget.getCurrentQuestion()].cardid);
				if (qw) {
					sideElem.find('.answerAgainBtn').toggle(qw.isEvaluated() && qw.getAnswerWidgets().length > 0)
				}
			}		
	    }
	    
	    function toggleSideElem() {
	    	if (sideElem.is(':visible')) {
	    		sideElem.fadeOut('fast');
	    		sideElemShown = false;
	    	} else {
		    	var sidebar = sideElem.find('.etest-player-sidebar').hide();
		    	sideElem.fadeIn('fast');
		    	sidebar.toggle('slide', {direction: ertl('right','left'),duration: 'fast'});
		    	sideElem.find('.hideSideElemBtn').focus();
		    	sideElemShown = true;
		    }
		}
		
		/*function arrayToObject(arr) {
			var obj = {};
			for (var i=0;i<arr.length;i++) {
				obj[i] = arr[i];
			}
			return obj;
		}*/
		var cardWidgetsById = {};
		var restoreMsgShown = false;
		function createPlayContent(doneFunc) {		
			contentElem.html('');
			loadingElem.show();		
	    	materialObj.getCards(currentVariantid, function(cardWidgets) {
				cardWidgetsById = cardWidgets;
	    		loadingElem.hide();
	    		initPlayData();
	    		createHeader();
	    		
				var s = '';
				
				if (restorableAnswersData && materialObj.getAllAnswerWidgets().length > 0) {
					var isEq = false;					
					if (opts.vysledokRow && answersData && restorableAnswersData.data && restorableAnswersData.data.odpovedexml && restorableAnswersData.data.odpovedexml.values) {
						isEq = EdubarUtils.isEqual({
										values: restorableAnswersData.data.odpovedexml.values,
										variant: restorableAnswersData.data.odpovedexml.variant || 0
									},{
										values: answersData.values,
										variant: answersData.variant || 0
									}, {
										objectArrays: true
									}
							);				
					}
					if (opts.vysledokRow && Date.fromDbString(opts.vysledokRow.cas,true).format('Y-m-d H:i:s') > new Date(restorableAnswersData.ts+rozdielServerCas).format('Y-m-d H:i:s')) {
						isEq = true;
					}
					
					if (!isEq) {
						var ss = ''
						ss += '<div class="etest-player-restore-answers-msg etest-player-restore-answers-elem">';
							ss += '<div class="etest-player-restore-answers-msg-inner">';
								
								
								ss += '<div style="display: inline-block">';
								if (!isFinished && opts.vysledokRow && !opts.vysledokRow.firsttime && opts.playTimeStart
									&& superObj.superRow && superObj.superRow.trvanie && superObj.superRow.trvanie > 0) {
									ss += renderS(ls(10296), {starttime: (new Date(playTimeStart).format('H:i:s'))})+'<br>';
								}
								ss += lset(10246);

								if (EdubarUtils.isParent()) {
									ss += '<div>';
										ss += '<b>{#2315}:</b> {#8329}. {#8332}.';
									ss += '</div>';
								}
								ss += '</div>';
								ss += '<div class="etest-player-restore-answers-msg-btns">';
									ss += '<input type="button" value="{#6894}" class="flat-button flat-button-greenm actionButton" data-action="restoreRestorableAnswersData"> ';
									ss += '<input type="button" value="{#7670}" class="flat-button flat-button-blue actionButton" data-action="showLocalResults"> ';
									ss += '<input type="button" value="{#1038}" class="flat-button flat-button-graym actionButton" data-action="cancelRestorableAnswers"> ';									
								ss += '</div>';
								ss += '<div style="clear:both"></div>';
							ss += '</div>';
						ss += '</div>';
						s += renderS(ss, {
							time: new Date(restorableAnswersData.ts).format('d.m.Y H:i:s'),
							r: restorableAnswersData
						});
						restoreMsgShown= true;
					}
				}				
				if (!restoreMsgShown && !isFinished && opts.vysledokRow && !opts.vysledokRow.firsttime && opts.playTimeStart
					&& superObj.superRow && superObj.superRow.trvanie && superObj.superRow.trvanie > 0
					&& materialObj.getAllAnswerWidgets().length > 0) {
					var ss = ''
					ss += '<div class="etest-player-restore-answers-msg etest-player-restore-answers-elem">';
						ss += '<div class="etest-player-restore-answers-msg-inner">';							
							
							ss += '<div style="display: inline-block">';
								
								ss += renderS(ls(10292), {starttime: (new Date(playTimeStart).format('H:i:s'))})+'<br>';
								if (EdubarUtils.isParent()) {
									ss += '<div>';
										ss += '<b>{#2315}:</b> {#8329}. {#8332}.';
									ss += '</div>';
								}
							ss += '</div>';
							ss += '<div class="etest-player-restore-answers-msg-btns">';								
								ss += '<input type="button" value="{#1573}" class="flat-button flat-button-graym actionButton" data-action="cancelRestorableAnswers"> ';									
							ss += '</div>';
							ss += '<div style="clear:both"></div>';
						ss += '</div>';
					ss += '</div>';
					s += renderS(ss, {												
					});
					restoreMsgShown = true;
				} 
				if (!restoreMsgShown && !isFinished && opts.vysledokRow && !opts.vysledokRow.firsttime
					&& materialObj.getAllAnswerWidgets().length > 0 && answersValues && answersValues.length>0) {
					var ss = ''
					ss += '<div class="etest-player-restore-answers-msg etest-player-restore-answers-elem">';
						ss += '<div class="etest-player-restore-answers-msg-inner">';
							
							
							ss += '<div style="display: inline-block">';
								ss += renderS(ls(10304), {time: (Date.fromDbString(opts.vysledokRow.cas,true).format('d. F H:i'))})+'<br>';

								if (EdubarUtils.isParent()) {
									ss += '<div>';
										ss += '<b>{#2315}:</b> {#8329}. {#8332}.';
									ss += '</div>';
								}
							ss += '</div>';
							ss += '<div class="etest-player-restore-answers-msg-btns">';								
								ss += '<input type="button" value="{#1573}" class="flat-button flat-button-graym actionButton" data-action="cancelRestorableAnswers"> ';									
							ss += '</div>';
							ss += '<div style="clear:both"></div>';
						ss += '</div>';
					ss += '</div>';

					s += renderS(ss, {});
					restoreMsgShown = true;
				}	
				
				/*if (opts.vysledokRow) {					
					var odpovedexml = typeof opts.vysledokRow.odpovedexml === 'string' ? JSON.parse(opts.vysledokRow.odpovedexml) : opts.vysledokRow.odpovedexml;
					if (odpovedexml.eplid && opts.eplid != odpovedexml.eplid && materialObj.getAllAnswerWidgets().length > 0
						&& Date.fromDbString(opts.vysledokRow.cas,true).getTime() > getCurrentTime().getTime()-5*3600*1000) {
					
						var ss = ''
						ss += '<div class="etest-player-restore-answers-msg etest-player-override-epl-elem">';
							ss += '<div class="etest-player-restore-answers-msg-inner">';							
								
								ss += '<div style="display: inline-block">';									
									ss += lset(10311)+'<br>';									
								ss += '</div>';
								ss += '<div class="etest-player-restore-answers-msg-btns">';								
									ss += '<input type="button" value="{#1487}" class="flat-button flat-button-greenm actionButton" data-action="overrideEplId"> ';									
									ss += '<input type="button" value="{#1488}" class="flat-button flat-button-graym actionButton" data-action="cancelOverrideEplid"> ';									
								ss += '</div>';
								ss += '<div style="clear:both"></div>';
							ss += '</div>';
						ss += '</div>';
						s += renderS(ss, {												
						});
					}
				}*/

				s += '<div class="etest-player-widget-content">';
				s += '</div>';
		    	
				
		    	
				contentElem.html(s);
				
				contentElem.find('.actionButton').click(function() {
					handleActionButton(this);				
				});	
		    	
		    	playerContentElem = contentElem.find('.etest-player-widget-content');
				
				if (opts.vysledokRow && !isFinished) {					
					var odpovedexml = typeof opts.vysledokRow.odpovedexml === 'string' ? JSON.parse(opts.vysledokRow.odpovedexml) : opts.vysledokRow.odpovedexml;
					if (odpovedexml.eplid && opts.eplid != odpovedexml.eplid && materialObj.getAllAnswerWidgets().length > 0
						&& Date.fromDbString(opts.vysledokRow.cas,true).getTime() > getCurrentTime().getTime()-5*3600*1000) {
						
						//createAnotherWindowMsg();
						isInactivePlayerWindow = true;
						barShowMessageBox(ls(10311), 'fa-warning',{
							okLbl: ls(1487),
							cancelLbl: ls(1488),
							confirm:function() {
								actionFuncs.overrideEplId();
							},
							close: function() {
								contentElem.find('.etest-player-override-epl-elem').remove();
							}
						});
					}
				}
				

	    		createCards(cardWidgets);	
	    		
	    		createSideElem(cardWidgets);
	    		
	    		if (doneFunc) {
	    			doneFunc();
	    		}
	    	}, function() {
				creteOfflineView();	
			});	   		    	
		}
		
		var isInactivePlayerWindow = false;
		function createAnotherWindowMsg() {			
			isInactivePlayerWindow = true;
			var ss = ''
			ss += '<div class="etest-player-restore-answers-msg etest-player-override-epl-elem">';
				ss += '<div class="etest-player-restore-answers-msg-inner">';							
					
					ss += '<div style="display: inline-block">';									
						ss += lset(10311)+'<br>';									
					ss += '</div>';
					ss += '<div class="etest-player-restore-answers-msg-btns">';								
						ss += '<input type="button" value="{#1487}" class="flat-button flat-button-greenm actionButton" data-action="overrideEplId"> ';									
						ss += '<input type="button" value="{#1488}" class="flat-button flat-button-graym actionButton" data-action="cancelOverrideEplid"> ';									
					ss += '</div>';
					ss += '<div style="clear:both"></div>';
				ss += '</div>';
			ss += '</div>';
			s = renderS(ss, {	

			});

			var elem = $(s).insertBefore(contentElem.find('.etest-player-widget-content'));

			elem.find('.actionButton').click(function() {
				handleActionButton(this);				
			});	
			
		}
	    
		var retryCountReset = false;
		var prng = new Math.seedrandom();
		var defaultRandomizeSeed = prng();
	    function createCards(cardWidgets) {	    			
			var screenProps = materialObj.materialData["options"] && materialObj.materialData["options"]["screenProps"] ? materialObj.materialData["options"]["screenProps"] : {};							
	    	mainWidget = materialObj.createPlayMainWidget(currentVariantid, answersValues, {
								interactivePreview: opts.interactivePreviewMode,
								seenData: seenData,
								evaluateEvaluated: isFinished ? true : false,
								canAutoEvaluate: superObj.zobrazovatSpravne('l1') && screenProps.cardsPerScreen == 'single',
								randomizeQuestionOrder: superObj.superRow.typ_nahody == 'uplne_nahodne' || opts.previewMode, 
								randomizeAnswers: superObj.superRow.typ_nahody == 'uplne_nahodne' || opts.previewMode || isTestMeMode() || opts.mode == 'testCompetences',
								useEditedAnswersOrder: opts.resultMode && isContestMode(),
								markCorrectAnswers: isFinished ? superObj.zobrazovatSpravne('l2') : superObj.zobrazovatSpravne('l1'),
								markCorrectAnswersMode: isTestMeMode() ? 'answeredOnly' : (screenProps && screenProps.markCorrectAnswersMode ? screenProps.markCorrectAnswersMode : ''),
								forceScoreValues: opts.resultMode && isContestMode() && opts.forceScoreValues ? opts.forceScoreValues : null,
								randomizeSeed: answersData && answersData.randomizeSeed 
												? answersData.randomizeSeed 
												: answersData && answersData.scoreData && (answersData.scoreData.randomizeSeed || answersData.scoreData.randomizeSeed === 0)
												? answersData.scoreData.randomizeSeed
												: defaultRandomizeSeed
						});
			
	    	if (!retryCountReset) {
	    		mainWidget.resetRetryCount();
	    		retryCountReset = true;
	    	}
	    	
			screenWidget = materialObj.screenWidget;
			screenWidget.previewMode = opts.previewMode;
			screenWidget.testMeMode = isTestMeMode() && opts.mode2 == 'testMe';
			screenWidget.onlySubmitMode = opts.onlySubmitMode;
			screenWidget.odovzdavanieMode = opts.odovzdavanieMode;
			screenWidget.resultMode = opts.mode == 'testCompetencesResults';
			screenWidget.isFinished = isFinished;
			if (opts.gotoQuestion && opts.mode != 'testCompetencesResults') {
				screenWidget._currentQuestion = opts.gotoQuestion;
			}

	    	s = mainWidget.getMainContent();
	    	
	    	mainWidgetElem = $(s).appendTo(playerContentElem);
		
			mainWidget.initWidgets();
	    	mainWidget.initDom(mainWidgetElem);    	
	    	mainWidget.initDomUI();	
	    	mainWidget.initDomUIPlay();	    
	    	
	    	if (isFinished) {
	    		//skoncime
	    		evaluateAllCards();
	    		screenWidget.setFinished();
	    	}
	    	
			mainWidget.addEventHandler('answered',handleAnswered);
			mainWidget.addEventHandler('answerChanged',handleAnswerChanged);			
	    	mainWidget.addEventHandler('scoreChanged',handleScoreChanged);
			mainWidget.addEventHandler('questionEvaluated',handleQuestionEvaluated);
	    	mainWidget.addEventHandler('gotoNext',handleGotoNext);
	    	mainWidget.addEventHandler('questionChanged',handleQuestionChanged);
			mainWidget.addEventHandler('submit',handleSubmit);	    	
			mainWidget.addEventHandler('saveResult',handleSaveResult);				    	
	    	mainWidget.addEventHandler('close',handleClose);
	    	handleScoreChanged();  	
			
			if (opts.gotoFile) {
				
				var d = materialObj.getCardForAttachement(opts.gotoFile);
				if (d) {
					screenWidget.setCurrentQuestion(d.index);
					
					var linkElem = screenWidget.element.find('.etest-seenfile-handle[data-src="'+et(opts.gotoFile)+'"]');
					if (linkElem.length > 0) {
						setTimeout(function() {
							linkElem.toggleClass('highlighted', true);
							setTimeout(function() {
								linkElem.toggleClass('highlighted', false);
							}, 5000);
						},400);
						ETestUtils.ensureElementInFocusRect(linkElem);
					}
				}
	    		opts.gotoFile = null;
			}

	    	if (opts.gotoQuestion && opts.mode != 'testCompetencesResults') {
	    		if (screenWidget._currentQuestion != opts.gotoQuestion) {
					screenWidget.setCurrentQuestion(opts.gotoQuestion);
				} else {
					handleQuestionChanged({index: screenWidget._currentQuestion});
				}
				
	    		opts.gotoQuestion = null;
			}
			
			
	    	
	    	if (isFinished) {
	    		showResult({scrollAnimation: scrollToTopAfterReload ? true : false});
				
	    	} else if ( isSeenOnlyMode()) {
				
				planSaveResult(null, 9000);
			}
			scrollToTopAfterReload = false;
			handleScroll();
			initAnswerLogEvents();
		}
		
		function handleAnswered(value, answerWidget) {			
			saveToLocalStorage();
			var questionWidget = answerWidget.getQuestionWidget();					
			questionWidget.isSkipped = false;	
			var allEvaluated = true;			
			if (/*materialObj.canAutoEvaluate() && */superObj.zobrazovatSpravne('l1')) {				
				if (questionWidget.getAnswerWidgets().length == 1 && !answerWidget.isA('ElaborationETestWidget')) {
					answerWidget.evaluate();		
					
					screenWidget.handleQuestionEvaluated(questionWidget);
				}
				/*var qas = questionWidget.getAnswerWidgets();
				var allCorrect = true;
				
				for (var i=0;i<qas.length;i++) {
					if (!qas[i].isCorrect(qas[i].getAnswered()) || !qas[i].isEvaluated()) {
						allCorrect = false;
					}
					if (!qas[i].isEvaluated()) {
						allEvaluated = false;
					}
				}
				
				if (isTestMeMode() && allEvaluated) {
					var rnd = Math.round(Math.random())+1;
					var audioElem = null;
					if (allCorrect) {						
						audioElem = mainElem.find('.etest_audio_success'+rnd).get(0);
					} else {
						audioElem = mainElem.find('.etest_audio_fail'+rnd).get(0);
					}
					if (audioElem) {
						mainElem.find('.etest_res_audio').each(function() {
							var n = this;
							n.pause();
							n.currentTime = 0;							
						});
						audioElem.play().then(function() {							
							if (allCorrect && materialObj.canAutoNext() && questionWidget.canAutoSkip()) {					
								screenWidget.ui_nextQuestion(audioElem.duration*1000+500);											
							}
						})
					}
				} else {
					if (allCorrect && materialObj.canAutoNext() && questionWidget.canAutoSkip()) {					
						screenWidget.ui_nextQuestion(1000);			
						//screenWidget.element.find('.etest-question-retrybtn').hide();	
					}
				}*/
				
			}
			
			handleScoreChanged();				
		}

		function handleAnswerChanged(data, answerWidget) {		
			somethingChanged = true;		
			
			var questionWidget = answerWidget.getQuestionWidget();					
			if (!questionWidget.isEvaluated() && questionWidget.setAnswersSaved) questionWidget.setAnswersSaved(false);

			handleScoreChanged();	
			
			if (materialObj && !materialObj.isSomethingAnswered()) return;	
			autosaveAnswerChanged();
			if (isSeenOnlyMode()) {				
				if (data === 'fileClicked') {
					saveResult(null);
				}else {		
					planSaveResult(null, 1000);
				}
			} else {
				saveToLocalStorage();
			}
			
			addAnswerLog(answerWidget);		
			if (screenWidget && screenWidget.handleAnswerChanged) {				
				var sidebarChanged = screenWidget.handleAnswerChanged();													
				if (sidebarChanged) {
					createSideElem(cardWidgetsById);
				}
			}
		}
		
		function useAnswerLog() {
			if (isSeenOnlyMode()) return false;	
			return true;
		}

	
		function initAnswerLogEvents() {
			if (!useAnswerLog()) return;
			if (isFinished) return;
			removeAnswerLogEvents();

			if (isWindowEnforcedMode()) {
				$(document).on('keydown.etestplayeral',function(e) {				
					if (e.which == 27) {							
						e.preventDefault();
						barShowMessage('Please do not exit full screen',1)
					}
				});
			}
			$(document).on('visibilitychange.etestplayeral', function(e) {
				
				if (document.hidden) {
					addAnswerLogEvent(e.target, "WINDOW_HIDDEN");
				} else {
					addAnswerLogEvent(e.target, "WINDOW_VISIBLE");					
				}
				handleWindowEnforcement();
			});
			$(window).on('blur.etestplayeral', function(e) {
				addAnswerLogEvent(e.target, "WINDOW_BLUR");
				handleWindowEnforcement()
			});

			$(window).on('enterBackgroundHandler.etestplayeral', function(e) {
				addAnswerLogEvent(e.target, "WINDOW_BLUR");
				handleWindowEnforcement()
			});
			$(window).on('enterForegroundHandler.etestplayeral', function(e) {
				addAnswerLogEvent(e.target, "WINDOW_FOCUS");
				handleWindowEnforcement()
			});

			$(window).on('focus.etestplayeral', function(e) {
				addAnswerLogEvent(e.target, "WINDOW_FOCUS");
				handleWindowEnforcement()
			});

			$(document).on("copy.etestplayeral", function(e0) {
				var e = e0.originalEvent;
				//var t = e && e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData('text/plain') : '???';		
				var t = window.getSelection && window.getSelection() ? window.getSelection().toString() : (e && e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData('text/plain') : '');					
				addAnswerLogEvent(e0.target, "COPY", t);				
			});

			$(document).on("paste.etestplayeral", function(e0) {
				var e = e0.originalEvent;
				var t = e && e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData('text/plain') : '???';				
				addAnswerLogEvent(e.target, "PASTE", t);
			});

			$(document).on("cut.etestplayeral", function(e0) {	
				var e = e0.originalEvent;
				var t = window.getSelection && window.getSelection() ? window.getSelection().toString() : (e && e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData('text/plain') : '');					
				addAnswerLogEvent(e.target, "CUT", t);
			});

			addAnswerLogEvent(mainElem, 'PLAYER_INITED');
		}

		function removeAnswerLogEvents() {
			$(document).off('visibilitychange.etestplayeral');
			$(window).off('blur.etestplayeral');
			$(window).off('focus.etestplayeral');
			$(document).off("copy.etestplayeral");
			$(document).off("paste.etestplayeral");
			$(document).off("cut.etestplayeral");
			$(document).off('keydown.etestplayeral');		
			$(window).off('enterBackgroundHandler.etestplayeral');
			$(window).off('enterForegroundHandler.etestplayeral');
		}

		function addAnswerLogEvent(target, type, data) {
			if (!useAnswerLog()) return;
			answerLogId++;
			var elem = $(target).closest('.etestw');
			var ew = elem.length>0 ? elem.data('etestWidget') : null;
			var qw = null;
			if (ew) {
				qw = ew.getQuestionWidget();
			}
			var item = {
				id: 'an'+answerLogId.toString().padStart(7,'0')+'_'+opts.eplid,
				type: type,		
				ts: getCurrentTime().format('Y-m-d H:i:s'),
				tsms: getCurrentTime().getTime(),
				rt: getRemainingTimeSeconds()
			}
			if (data) {
				item["data"] = data;
			}
			if (ew) {
				item['awClass'] = ew.getWidgetClass();
				if (ew.getQuestionAnswerIndex) {
					item['awIndex'] = ew.getQuestionAnswerIndex();
				}
			}	
			if (qw) {
				item["cardid"] = qw.getCardid();
			}
		

			var key = 'events';
			if (!answerLogByWidget[key]) answerLogByWidget[key] = [];
			answerLogByWidget[key].push(item);		

			sessionStorage.setItem('etestPlayerLastAnswerLogId', answerLogId);
			
		}
					
		var answerLogId = sessionStorage.getItem('etestPlayerLastAnswerLogId') || 0;				
		var answerLogByWidget = {};		
		function addAnswerLog(answerWidget) {		
			if (!useAnswerLog()) return;	
			if (!answerWidget) return;

			if (!answerWidget.isA('AnswerETestWidget')) return;

			var qw = answerWidget.getQuestionWidget();			
			answerLogId++;
			var html = '';
			var inputValues = [];

			var item = {
				id: 'an'+answerLogId.toString().padStart(7,'0')+'_'+opts.eplid,
				type: 'ANSWER',
				ts: getCurrentTime().format('Y-m-d H:i:s'),
				tsms: getCurrentTime().getTime(),
				awClass: answerWidget.getWidgetClass(),
				cardid: qw.getCardid(),
				awIndex: answerWidget.getQuestionAnswerIndex ? answerWidget.getQuestionAnswerIndex() : '',
				answered: answerWidget.getAnswered ? answerWidget.getAnswered() : '',
				rt: getRemainingTimeSeconds(),
				html: null,//html,
				ivals: null//inputValues,				
			}

			var key = item.cardid+'#'+item.awIndex;
			if (answerWidget.getWidgetClass() == 'ElaborationETestWidget') {
				answerLogByWidget[key] = [item];
			} else {
				if (!answerLogByWidget[key]) answerLogByWidget[key] = [];
							
				if (answerLogByWidget[key].length > 10) {					
					answerLogByWidget[key].splice(0, answerLogByWidget[key].length-9);
				}
				
				answerLogByWidget[key].push(item);				
			}

			setTimeout(function() {
				if (answerWidget.element && answerWidget.element.get(0)) {
					if (answerWidget.isA('SvgAnswerETestWidget')) {
						item.html = 'n/a SVG';					
						item.ivals = inputValues;
					} else {
						html = answerWidget.element.get(0).outerHTML;
						answerWidget.element.find('input[type="text"],input[type="number"],textarea,select').each(function() {
							inputValues.push($(this).val());
						});
						item.html = html;					
						item.ivals = inputValues;
					}
				}
			}, 50);

			sessionStorage.setItem('etestPlayerLastAnswerLogId', answerLogId);
		}

		function zipLog(val) {
			var ts = Date.now();
			var encoder = new TextEncoder()
			
			var gz = new Zlib.RawDeflate(encoder.encode(val));
			var compressed = gz.compress();
			var cs1 = '';
		
			for (var i=0;i<compressed.length;i += 10000) {
				cs1 += String.fromCharCode.apply(null, compressed.subarray(i, i+10000));
			}
			return btoa(cs1); 
		}

		function isSeenOnlyMode() {
			if (!opts.previewMode
				&& !isFinished 
				&& !isWaiting
				&& materialObj 
				&& !(materialObj.isSomethingAnswered()) 
				&& materialObj.getAllAnswerWidgets().length == 0	
				&& !isTestMeMode()		
				&& materialObj.getCardWidgets().length > 0	
				&& EdubarUtils.isStudentOrParent()
				) {	
					return true;
			}
			return false;
		}

		var _lastScoreData = null;
		function handleQuestionEvaluated(data, answerWidget) {						
			var scoreData = materialObj.getScoreData(currentVariantid);				
			if (scoreData.questionsAnswered > 0 && isTestMeMode() && !ETestUtils.isEqual(_lastScoreData, scoreData, {seenData: true, seenScore: true, seenScoreMax: true, seenScorePercent: true, remainingTime: true})) {
				planSaveResult(function() {					
				},30);
			} else if (materialObj.isSecured && scoreData.questionsAnswered > 0 && !ETestUtils.isEqual(_lastScoreData, scoreData, {seenData: true, seenScore: true, seenScoreMax: true, seenScorePercent: true, remainingTime: true})) {				
				var aws = materialObj.getAllAnswerWidgets();
				var needDownloadUnsecuredData = false;
				for (var i=0;i<aws.length;i++) {
					var aw = aws[i];
					if (aw._needDownloadUnsecuredData) {
						needDownloadUnsecuredData = true;
						break;
					}
				}
				if (needDownloadUnsecuredData) {
					saveResult(function() {
						var qwsToEvaluate = [];
						for (var i=0;i<aws.length;i++) {
							var aw = aws[i];
							if (aw._needDownloadUnsecuredData && aw._unsecuredData) {
								aw.evaluate();
								var qw = aw.getQuestionWidget();
								if (EdubarUtils.indexOf(qwsToEvaluate, qw) <0) {
									qwsToEvaluate.push(qw);
								}
								
							}
						}
						for (var i=0;i<qwsToEvaluate.length;i++) {
							screenWidget.handleQuestionEvaluated(qwsToEvaluate[i]);								
						}
						handleScoreChanged();
					}, false);
				}
			}
			_lastScoreData = scoreData;
		}
		
		function handleScoreChanged(data, answerWidget) {
			
			var scoreData = materialObj.getScoreData(currentVariantid);
			if (interactiveElems.answeredQuestionsElem) {
				interactiveElems.answeredQuestionsElem.html(scoreData.questionsAnswered + ' / '+scoreData.questionsTotal);
			}
			
			if (interactiveElems.scorePercentElem) {
				interactiveElems.scorePercentElem.html(scoreData.scorePercent.toFixed(1));
			}		
			
			validateSidebarCards();
			if (screenWidget.invalidateVisibleWidgets) screenWidget.invalidateVisibleWidgets();
			screenWidget.createActionButtons();
			handleScroll();
			
			
		}
		
		function handleGotoNext(data, answerWidget) {			
			screenWidget.ui_nextQuestion();
		}
		
		function handleQuestionChanged(data, widget) {
			if (interactiveElems.currentCardElem) {
				if (isTestMeMode()) {
					interactiveElems.currentCardElem.html((data.index+1));
				} else {
					interactiveElems.currentCardElem.html((data.index+1) + ' / '+cardWidgets.length);
				}
			}
			
			validateSidebarCards();
			
			if (isFinished) {
	    		showResult({scrollAnimation: false});
			}
			
			if (opts.questionChangedFunc) {
				opts.questionChangedFunc(data);
			}
			
			if (isSeenOnlyMode()) {

				planSaveResult(null, 5000);
			}	
		}
		
		function handleClose(data, widget) {
			if (isSecureMode()) {
			} else {
				publicActions.playerClose();
			}
		}
		
		function handleSaveResult(data, widget) {
			if (isFinished) {
				return;
			}
			
			saveResult(function() {
				barShowMessage(ls(1310));
			}, false, 0, false, true);
		}


		function getCountUploadingFiles() {
			if (!mainWidget) return 0;
			var elaborations = mainWidget.findByWidgetClass('ElaborationETestWidget');
			var numUploading = 0;
			for (var i=0;i<elaborations.length;i++) {
				var w = elaborations[i];
				if (w.uploadingFiles && w.uploadingFiles.length >0) {
					numUploading += w.uploadingFiles.length;
				}
			}
			return numUploading;
		}
		function showWaitForUploadDlg(doneFunc) {
			var timeout = null

			var s = '';
			s += '<div style="padding:15px;text-align:center;">';
				s += '<div style="font-size:48px;opacity:0.5">';
					s += '<i class="fa fa-fw fa-spinner fa-spin"></i>';
				s += '</div>';
				s += '<div style="margin:15px 0">'
					s += '{#10252}';
				s += '</div>';
				s += '<div class="">';
					s += '{#10251}: <b class="uploadingFilesCount">{uploadingCount}</b>';
				s += '</div>';
				s += '<div style="margin-top: 15px">';
					s += '<input type="button" class="flat-button flat-button-graym" value="{#1038}" onClick="barCloseDialog(this)">'
				s += '</div>';
			s += '</div>';

			s = renderS(s, {
				uploadingCount: getCountUploadingFiles()
			})

			var dlg = barNewDialog({
				content: s, 
				dialogClass: 'whiteDialog noPadding',
				close: function() {
					if (timeout) clearTimeout(timeout);
				},
				width: 400
			});
			
			function initCounter() {
				timeout = setTimeout(function() {
					var count = getCountUploadingFiles();
					if (count == 0) {
						barCloseDialog(dlg);
						doneFunc();
					} else {
						dlg.find(".uploadingFilesCount").html(count);
						initCounter();
					}
				},300);
			}
			initCounter();
		}
		
		function handleSubmit(data, widget) {
			
			if (isFinished) {
				if (resultSaveError) {
					handleSubmit0(true);
					return;
				}
				actionFuncs.close();
				return;	
			}
			
			var scoreData = materialObj.getScoreData(currentVariantid);
						
			/*var numUploading = getCountUploadingFiles();


			if (numUploading > 0) {
				if (true) {
					showWaitForUploadDlg(function() {
						handleSubmit(data, widget);
					})
				} else {
					barShowMessageBox(ls(10219), 'fa-warning',{
						okLbl: ls(8218),
						confirm: function() {
							handleSubmit0();
						}
					});	
				}
			} else*/	
			
			if (isTestMeMode()) {
				if (screenWidget.props && screenWidget.props.cardsPerScreen == 'single') {
					handleQuestionEvaluated();
				} else {
					if (materialObj.cardsOnlyMode && !isTestMePlayTestMode()) {
						materialObj.setSkippedUnanswered();
					}
					handleSubmit0();
				}
			} else 
			if (!materialObj.isSomethingAnswered() && !materialObj.canAutoEvaluate()) {
				barShowMessageBox(ls(8349), 'fa-warning');				
					
			} else 
			if (scoreData.questionsAnswered < scoreData.questionsTotal) {
				var s = opts.onlySubmitMode ? ls(11678) : ls(8350);
				var notAnswered = [];
				if (screenWidget && screenWidget.widgets) {
					var widgets = screenWidget.getVisibleWidgets ? screenWidget.getVisibleWidgets() : screenWidget.widgets;
					for (var i=0;i<widgets.length;i++) {					
						var w = widgets[i];		
						if (!w) continue;				
						if (!w.isAnswered()) {
							notAnswered.push(ls(3837)+'&nbsp;'+(w.getQuestionIndex()).toString()+'.');
						}
					}
				}
				if (notAnswered.length>0) {
					s += '<br><br>'+lset(10329)+': <b>'+notAnswered.join(', ')+'</b>';	
				}

				barShowMessageBox(s, 'fa-warning',{
					okLbl: ls(10328),
					okClass: 'button-red',
					confirm: function() {
						handleSubmit0(true);
					}
				});	
			} else
			if (opts.mode == 'testCompetences' && screenWidget.props && screenWidget.props.cardsPerScreen == 'single') {
				handleSubmit0(true);
			} else 
			if (ETestUtils.isProjectMode(materialObj.etestType)) {
				var msg = ls(8890);
				if (isInactivePlayerWindow) {
					msg += '<br><br>';
					msg += '<b>'+lset(2315)+'</b>: '+etnl2br(ls(10310))
				}
				barShowMessageBox(msg, 'fa-question',{
					okLbl: isInactivePlayerWindow ? ls(7230) : '',
					confirm: function() {
						handleSubmit0(true,null, false, true);
					}
				});			
			} else {
				handleSubmit0(true);
			}	
		}
		
		var checkTimeXhr = null;
		function doCheckEndTime(doSubmitFunc) {
			if (isContestMode()) {
				if (doSubmitFunc) doSubmitFunc();
				return;
			}
			if (checkTimeXhr) return;
			barStartLoading();
			var postData = {				
				vysledokid: opts.vysledokid ? opts.vysledokid : '',
				pridelenieid: opts.pridelenieid ? opts.pridelenieid : '',
				superid: opts.superid ? opts.superid : '',
				testid: opts.testid ? opts.testid : '',
				cardsOnlyMode: opts.testid ? '' : '1',
				isSecured: materialObj.isSecured ? '1' : '',
				useEplid: materialObj.getAllAnswerWidgets().length == 0 ? '0' : '1',
				eplid: opts.eplid,
				isSeenOnlyMode: isSeenOnlyMode() ? '1' : ''
			}
			checkTimeXhr = $.post(opts.formurl+'&akcia=getEndTime', postData, function(data) {	
				barEndLoading();
				checkTimeXhr = null;			
				handleEndTimeCheckReceived(data, doSubmitFunc);
			},'json').fail(function() {
				barEndLoading();
				checkTimeXhr = null;
				if (doSubmitFunc) doSubmitFunc();
			}).always(function() {
				checkTimeXhr = null;
			});
		}
		
		function handleSubmit0(forceSkoncil, afterSaveFunc, quietMode, overrideEplid) {

			if (quietMode == 'timeisup') {
				
				doCheckEndTime(function() {
					handleSubmit0a(forceSkoncil, afterSaveFunc, quietMode, overrideEplid);
				})
			} else {
				handleSubmit0a(forceSkoncil, afterSaveFunc, quietMode, overrideEplid);
			}
		}

		function handleSubmit0a(forceSkoncil, afterSaveFunc, quietMode, overrideEplid) {
			var numUploading = getCountUploadingFiles();			

			isFinished = true;
			stopTime();				
			
			
			if (numUploading > 0) {				
				showWaitForUploadDlg(function() {
					handleSubmit1(forceSkoncil, afterSaveFunc, quietMode, overrideEplid);
				});				
			} else {
				handleSubmit1(forceSkoncil, afterSaveFunc, quietMode, overrideEplid);
			}
		}

		function handleSubmit1(forceSkoncil, afterSaveFunc, quietMode, overrideEplid) {			
			evaluateAllCards();
			if (isInactivePlayerWindow && quietMode) {
				showResult({
					anotherEplidResultBar: true
				});
			} else {				
				saveResult(function(scoreData) {
					showResult({
						scoreData: scoreData
					});	
					if (afterSaveFunc) {
						afterSaveFunc();
					}
				}, forceSkoncil, 0, quietMode, overrideEplid);		
			}
		}
		
		function evaluateAllCards(force) {			
			//var scoreData = materialObj.getScoreData(currentVariantid);
			var numNotEvaluated = 0;
			var answerWidgets = materialObj.getAllAnswerWidgets(currentVariantid);
			for (var i=0;i<answerWidgets.length;i++) {
				var w = answerWidgets[i];
				if (!w.isEvaluated() || force) {
					if (!w.getQuestionWidget().isSkipped) {
						w.evaluate();
					} else {
						w.disable();						
					}
					
					
					numNotEvaluated++;
				}
				w.disable();
			}	
			
			isFinished = true;
			stopTime();	
			
		}
			
		
		function getQuestionWidget(cardid) {
			if (!questionWidgets[cardid]) {
			
				var card = ETestUtils.cardsData[cardid];
				
				var q = new QuestionETestWidget();
				q.loadData(card.content);
				questionWidgets[cardid] = q;
			}
			
			return questionWidgets[cardid];		
		}
		
		var autosaveTimeout = null;
		var changedSinceAutosave = false;
		var lastAutosave = Date.now();
		var autosavePaused = false;
		function autosaveAnswerChanged() {
			changedSinceAutosave = true;	
		}		
		function initAutosaveTimer() {						
			if (autosaveTimeout) clearTimeout(autosaveTimeout);
			if (!opts.autosaveInterval) return;
			if (isSeenOnlyMode()) return;
			if (isFinished) return;
			if (isTestMeMode()) return;

			autosaveTimeout = setTimeout(function() {				
				if (isFinished) return;
				
				if (!changedSinceAutosave || autosavePaused) {
					initAutosaveTimer();
					return;
				} 
				if (lastAutosave > Date.now() - opts.autosaveInterval*1000) {
					initAutosaveTimer();
					return;
				} 
				saveResult(function() {
					lastAutosave = Date.now();
					
					initAutosaveTimer();
				}, false, 0, true);
				
			}, 3000);
		}

		function pauseAutosaveTimer() {
			autosavePaused = true;			
		}
		function resumeAutosaveTimer() {
			autosavePaused = false;			
		}
		
		function initializeTime(doSubmitFunc) {			
			if (isFinished) {
				stopTime();
			} else {
				finishedDuration = false;
				if (playTimeInterval) clearInterval(playTimeInterval);
				
				if (!playTimeStart) playTimeStart = getCurrentTime().getTime();
				if (opts.playTimeStart) {
					playTimeStart = ETestUtils.isNumeric(opts.playTimeStart) ? opts.playTimeStart*1000 : Date.fromDbString(opts.playTimeStart).getTime();
					/*if (!isFinished && opts.vysledokRow && !opts.vysledokRow.firsttime) {
						barShowMessage(renderS(ls(10292), {starttime: (new Date(playTimeStart).format('H:i:s'))}), 10000);
					}*/
				} else {
					opts.playTimeStart = new Date(playTimeStart).format('Y-m-d H:i:s');										
				}
				casKonca = false;
				if (superObj.superRow.trvanie && superObj.superRow.trvanie > 0) {
					casKonca = playTimeStart + superObj.superRow.trvanie*1000;	
				}
				
				if (superObj.superRow.koniec_timezone  && materialObj.etestType != ETestUtils.etestTypeHomework) {
					casKonca = casKonca 
								? Math.min(casKonca, Date.fromDbString(superObj.superRow.koniec_timezone).getTime())
								: Date.fromDbString(superObj.superRow.koniec_timezone).getTime();
				}
		
				if (_casKoncaInitialized && _casKoncaInitialized != casKonca && Math.abs(_casKoncaInitialized - casKonca)>1000) {
					if (casKonca - _casKoncaInitialized > 0) {
						barShowMessage(renderS(ls(11780)+': {time_diff}',{time_diff: timeDiffStr(casKonca - _casKoncaInitialized)}), 7000, 'etest-barmessage-below-time');
					} else {
						barShowMessage(renderS(ls(2315)+': '+ls(11781)+': {time_diff}',{time_diff: timeDiffStr(_casKoncaInitialized - casKonca)}), 7000, 'etest-barmessage-below-time');
					}
				}

				
				_casKoncaInitialized = casKonca;

				if (doSubmitFunc && casKonca - getCurrentTime().getTime() <= 0) {
					doSubmitFunc();
					return;				
				}

				
								
				handleTimeTimer();
				lastTick = 0;
				playTimeInterval = setInterval(handleTimeTimer, 300);
				lastAutosave = Date.now();
				initAutosaveTimer();
			}		
		}

		function timeDiffStr(diff) {
			var rem = Math.round(Math.abs(diff)/1000);
			var dh = Math.floor(rem / 3600);
			var rem = rem - dh*3600;
			var dm = Math.floor(rem / 60);
			rem = rem - dm*60;
			var ds = Math.round(rem);

			var s = '';
			if (dh > 0) s += dh+' h ';
			if(dm > 0) s += dm+' min ';
			if (ds > 0) s += ds+' s';

			return s;
		}

				
		function handleEndTimeCheckReceived(data, doSubmitFunc) {
			if (!data) {
				if (doSubmitFunc) doSubmitFunc();
				return;
			}

			var changes = superObj.handleSuperRowChange(data);			
			if (changes && (changes["trvanie"] || (changes["koniec_timezone"] && materialObj.etestType != ETestUtils.etestTypeHomework))) {

			
				initializeTime(doSubmitFunc);
			
			} else {
				if (doSubmitFunc) doSubmitFunc();
			}
		}
		
		function stopTime(skipFinished) {
			if (playTimeInterval) clearInterval(playTimeInterval);
			if (interactiveElems.timeElem && !skipFinished) {
				interactiveElems.timeElem.html(renderS('<span style="color:#F44336">{#8217}</span>',{}));
			}			
			if (isFinished && finishedDuration === false) {
				finishedDuration = getTestDuration();
			}
			
		}
		
		var timeisUpMsg = false;		
		var lastTick = 0;
		var updatingServerTime = false;

		var lastMinutTimeCheckRand = null;
		var wasLastMinuteTimeCheck = false;
		function handleTimeTimer() {
			var d = new Date();
			var timezoneOffset = d.getTimezoneOffset();

			if (timezoneOffset != lastTimezoneOffset || (lastTick && Math.abs(d.getTime() - lastTick) > 20000)) {						
				updateServerTime();
			}

			lastTick = d.getTime();

			if (updatingServerTime) {				
				return;
			}
			
			var currentTime = getCurrentTime().getTime();
			
			var rozdiel = currentTime - playTimeStart;

			
			if (casKonca) {
				if (interactiveElems.timeElem)  interactiveElems.timeElem.parent().css('visibility','visible');
				rozdiel = Math.max(0, casKonca - currentTime);
				
				if (rozdiel <= 0) {//45*60*1000-10000) {					
					handleSubmit0(true, function() {
						barShowMessageBox(etnl2br(ls(10293)), 'fa-warning');
					}, 'timeisup');
					timeisUpMsg = true;					
					return;	
				}
				if (lastMinutTimeCheckRand === null) {
					lastMinutTimeCheckRand = 10000 - Math.random()*20000;
				}
				if (rozdiel <= (60*1000 - lastMinutTimeCheckRand)) {
					if (!wasLastMinuteTimeCheck) {
						wasLastMinuteTimeCheck = true;
						doCheckEndTime();
					}
				} else {
					wasLastMinuteTimeCheck = false;
				}
				var ts = EdubarUtils.formatTimeDiff(rozdiel, {short: true});
				if (interactiveElems.timeElem) interactiveElems.timeElem.html(ts).parent().css('visibility',ts ? 'visible' : 'hidden');
			} else {
				if (interactiveElems.timeElem) interactiveElems.timeElem.parent().css('visibility','hidden');
			}
		}

		function getRemainingTimeSeconds() {
			if (!casKonca) return null;
			var currentTime = getCurrentTime().getTime();
			
			return Math.round((currentTime - playTimeStart)/1000);
		}


		function getLocalStorageKey() {
			var key = opts.testid+';'+opts.superid+';'+opts.pridelenieid+';'+EdubarUtils.getLoggedUser();
			if (opts.pocetPokusov>0) {
				key += ';'+opts.pocetPokusov.toString();
			}
			return key;
		}
		
		function getCipherKey() {			
			if (opts.uidsgn) {
				return opts.uidsgn;
			}
			if (edubar && edubar.options && edubar.options.uidsgn) {
				return edubar.options.uidsgn;
			}
			return '';
		}
		
		var autosaving = false;
		var autoSaveTimer = null;
		function planToSaveLocalStorage() {			
			if (autoSaveTimer) {
				clearTimeout(autoSaveTimer);
			}
			autoSaveTimer = setTimeout(function() {
				autoSaveTimer = null;
				if (autosaving) {
					planToSaveLocalStorage();
					autosaving = false;
				} else {
					saveToLocalStorage();
				}
				
			},5000);
		}

		var etestPlayerID = null;
		function saveToLocalStorage(doneFunc) {
			if (opts.localAutosave === false) return;
			if (!getCipherKey()) return;

			if (!window.Worker) return;
			if (!opts.testid) return;
			if (!materialObj) return;
			if (materialObj.getAllAnswerWidgets().length == 0) return;

			//return; //docasne sa nesavuje
			
			autosaving = true;
			if (!window.autosaveWorker) {
				window.autosaveWorker = new Worker('/elearning/pics/js/etest/etestAutosaveWorker.js?v=20200408h');				
			}
			var scoreData = materialObj.getScoreData(currentVariantid, {countNotEvaluated: true});
			if (!etestPlayerID) {
				etestPlayerID = Math.round((Math.random()*10000)).toString()+(new Date()).getTime().toString();
			}

			var d = {				
				localStorageKey: getLocalStorageKey(),
				cipherKey: getCipherKey(),
				cardEditorId: etestPlayerID,
				numCards: scoreData.questionsAnswered,
				dataToStore: {
					ts: (new Date()).getTime(),
					data: scoreData	
				}
			}			
			window.autosaveWorker.postMessage(d);
			window.autosaveWorker.onmessage = function(e) {
				autosaving = false;
				if (doneFunc) doneFunc();
			}
		}

		function getLocalStorageResults(doneFunc) {				
			if (!getCipherKey()) {
				doneFunc([]);
				return;	
			}
			
			var ret = [];			
			if (typeof localforage == 'undefined') return;
			localforage.getItem(getLocalStorageKey()).then(function(databuf) {
				if (!databuf) {doneFunc(ret);return;}				
	
				ETestCrytoUtils.simpleDecrypt(databuf, getCipherKey(), function(data) {				
					var items =  data ? JSON.parse(LZString.decompressFromUint8Array(data)) : [];			
					
					for (var i=0;i<items.length;i++) {
						var item = items[i];
				
						ret.push(item);
					}
	
					ret.sort(function(a,b) {
						if (a.ts > b.ts) return -1;
						if (a.ts < b.ts) return 1;
						return 0;
					});
	
					doneFunc(ret);
	
				});		
			}).catch(function() {});
				
		}

		function getLocalStorageResultData(id, doneFunc) {		
			if (!getCipherKey()) return;	
			if (!id) return;
			if (typeof localforage == 'undefined') return;
			id = id.toString();
			if (id.substr(0,3) == 'r0_') {
				getLocalStorageResults0(function(results) {
					doneFunc(results[id.substr(3)*1]);
				})
				return;
			}
			var ret = [];
			var dstkey = getLocalStorageKey()+'##'+id;
			localforage.getItem(dstkey).then(function(databuf) {
				if (!databuf) {doneFunc(ret);return;}				
	
				ETestCrytoUtils.simpleDecrypt(databuf, getCipherKey(), function(data) {						
					var ret =  data ? LZString.decompressFromUint8Array(data) : '';				
					try {
						ret = JSON.parse(ret);
					} catch (e) {
						ret = null;
					}
					doneFunc(ret);	
				});		
			}).catch(function() {});
				
		}

		/*function saveToLocalStorage0_old() {
			if (!getCipherKey()) return;

			var scoreData = materialObj.getScoreData(currentVariantid, {countNotEvaluated: true});
			if (!opts.testid) return;

			var itemsStr = localStorage.getItem('testResultsEnc1');
			if (itemsStr) itemsStr = Base64.decode(itemsStr, true);
			var items = itemsStr ? JSON.parse(itemsStr) : null;
			if (!items) items = {};

			var key = getLocalStorageKey();

			if (!items[key]) items[key] = '';

			if (!window.etestPlayerID) {
				window.etestPlayerID = (new Date()).getTime();
			}
			
			
			ETestUtils.simpleDecrypt(items[key], getCipherKey(), function(data) {				
				items[key] =  data ? JSON.parse(LZString.decompressFromUTF16(data)) : {};
				if (!items[key]) items[key] = {};	
				
				var mints = (new Date()).getTime() - 7*24*3600*1000;
				for (var wndid in items[key]) {
					var item = items[key][wndid];
					
					if (item.ts < mints) {
						delete items[key][wndid];
					}					
				}

				items[key][window.etestPlayerID] = {
					ts: (new Date()).getTime(),
					data: scoreData					
				}

		
				ETestUtils.simpleEncrypt(LZString.compressToUTF16(JSON.stringify(items[key])), getCipherKey(), function(cipherText) {					
					items[key] = cipherText;
					
					var str = JSON.stringify(items);
				
					try {
						localStorage.setItem('testResultsEnc1', Base64.encode(str, true));
					} catch (e) {
						
						localStorage.clear();
						localStorage.setItem('testResultsEnc1', Base64.encode(str, true));						
					}
				});
			});
		}*/

		function getLocalStorageResults0(doneFunc) {		
			if (!getCipherKey()) return;	
			var ret = [];
			var itemsStr = localStorage.getItem('testResultsEnc1');
			if (itemsStr) itemsStr = Base64.decode(itemsStr, true);
			var items = itemsStr ? JSON.parse(itemsStr) : null;
			if (!items) items = {};

			var key = getLocalStorageKey();
			if (!items[key]) items[key] = '';
			
			ETestUtils.simpleDecrypt(items[key], getCipherKey(), function(data) {				
				items[key] =  data ? JSON.parse(LZString.decompressFromUTF16(data)) : {};
				if (!items[key]) items[key] = {};

				var mints = (new Date()).getTime() - 7*24*3600*1000;

				for (var wndid in items[key]) {
					var item = items[key][wndid];
					
					if (item.ts < mints) {
						continue;
					}
					
					ret.push(item);
				}

				ret.sort(function(a,b) {
					if (a.ts > b.ts) return -1;
					if (a.ts < b.ts) return 1;
					return 0;
				});

				doneFunc(ret);

			});			
		}




		var planSaveTimeout = null;
		function planSaveResult(doneFunc, timeout) {	
			if (opts.mode == 'testCompetencesResults') return;		
			if (planSaveTimeout) {
				clearTimeout(planSaveTimeout);
			}
			planSaveTimeout = setTimeout(function() {
				planSaveTimeout = null;
				saveResult(doneFunc);
			},timeout ? timeout : 5000);
		}


		function saveResult(doneFunc, forceSkoncil, retryCounter, quiet, overrideEplid) {	
			if (opts.mode == 'testCompetencesResults') return;

			if (planSaveTimeout) {
				clearTimeout(planSaveTimeout);
				planSaveTimeout = null;
			}
			if (retrySaveTimeout) {
				clearTimeout(retrySaveTimeout);
				retrySaveTimeout = null;
			}
			resultSaveError = false;					
			var scoreData = materialObj.getScoreData(currentVariantid, {countNotEvaluated: true, duration: getTestDuration(), onlyNotSaved: isTestMeMode()});
			saveToLocalStorage();
			if (forceSkoncil === false) {
				scoreData["skoncil"] = forceSkoncil;
				scoreData["forceSkoncil"] = forceSkoncil;
			} else {
				if (forceSkoncil === true) {
					scoreData["skoncil"] = true;
					scoreData["forceSkoncil"] = true;
				}			
			}
			
			if (playTimeStart) {
				scoreData.duration = Math.round((getCurrentTime().getTime() - playTimeStart)/1000);
				scoreData.clientTime = (new Date()).format('Y-m-d H:i:s');
				scoreData.mergedTime = getCurrentTime().format('Y-m-d H:i:s');
			}
			saveResult0(scoreData, doneFunc, retryCounter, forceSkoncil, quiet, overrideEplid);
		}

		var maxRetryCounter = 3;
		var retrySaveTimeout = null;
		function saveResult0(scoreData, doneFunc, retryCounter, forceSkoncil, quiet, overrideEplid) {			
			somethingSaved = true;
			if (opts.saveResultFunc) {
				opts.saveResultFunc(scoreData, function() {
					if (doneFunc) {
						doneFunc();
					}
				});
			} else {
				if (loadingElem) loadingElem.show();
				changedSinceAutosave = false;	
				
				pauseAutosaveTimer();
								
				var postData = {
					scoreData: JSON.stringify(scoreData),
					vysledokid: opts.vysledokid && !isTestMeMode() ? opts.vysledokid : '',
					pridelenieid: opts.pridelenieid ? opts.pridelenieid : '',
					superid: opts.superid ? opts.superid : '',
					testid: opts.testid ? opts.testid : '',
					cardsOnlyMode: opts.testid ? '' : '1',
					isSecured: materialObj.isSecured ? '1' : '',
					useEplid: materialObj.getAllAnswerWidgets().length == 0 ? '0' : '1',
					eplid: opts.eplid,
					isSeenOnlyMode: isSeenOnlyMode() ? '1' : ''
				}

				if (opts.testMeTestid) {
					postData["testMeTestid"] = opts.testMeTestid;
				}
				if (opts.testMeFromTestid) {
					postData["testMeFromTestid"] = opts.testMeFromTestid;
				}
				if (useAnswerLog()) {
					var zanswerLog = '';
					var answerLogAppendStr = '';
					if (answerLogByWidget && !EdubarUtils.isEmptyObject(answerLogByWidget)) {
						var ts = Date.now();
					
					
						var str = JSON.stringify(answerLogByWidget);
						answerLogAppendStr += 'v2;plain: '+str.length+'B;'+(Date.now() - ts)+'ms;';

						zanswerLog = zipLog(str);					
				
						answerLogAppendStr += '\nzipped: '+zanswerLog.length+'B;'+(Date.now() - ts)+'ms;';		
						answerLogAppendStr += '\nts: '+getCurrentTime().format('Y-m-d H:i:s.u');

						postData["answerLog"] = 'z:'+zanswerLog;
						postData["answerLogAppendStr"] = answerLogAppendStr;
					}
					
				}
				if (overrideEplid) {
					postData['overrideEplid'] = '1';
				}
				maxRetryCounter = opts.retryurls ? opts.retryurls.length + 2 : 3;
				var url = opts.retryurls && retryCounter>1 && opts.retryurls[retryCounter-2] ? opts.retryurls[retryCounter-2] : opts.formurl;
				var xhr = $.post(url+'&akcia=etestVysledok', postData, function(data) {
					
					if (loadingElem) loadingElem.hide();
					if (data && data.endTimeCheck) {
						handleEndTimeCheckReceived(data.endTimeCheck);
					}
					if (data.status != 'ok') {
						if (data.clearAnswerLog) {
							answerLogByWidget = {};							
						}
						if (data.data && data.data.reason == 'afterDeadline') {
							if (!quiet || quiet == 'timeisup') {
								barShowMessageBox(ls(10288), 'fa-warning');
							}
						} else 
						if (data.data && data.data.reason == 'finished') {
							isFinished = true;
							stopTime(true);
							if (quiet == 'timeisup') {
								showResult({anotherEplidResultBar: true});
							} else {
								if (!quiet || quiet == 'timeisup') {
									barShowMessageBox(ls(10295), 'fa-warning');
								}
								
								reloadAfterWaiting0();
							}
						} else 
						if (data.data && data.data.reason == 'anotherWindow') {
							if (quiet == 'timeisup') {
								showResult({anotherEplidResultBar: true});
							} else
							if (!quiet) {
								overrideAnotherWindowDlg(function() {
									saveResult0(scoreData, doneFunc, retryCounter, forceSkoncil, quiet, true);
								});
							} else {
								//pauseAutosaveTimer();//radsej nie - ak nieco zmeni, ne sa znovu zobrazi hlaska 
								if (!isFinished) {
									createAnotherWindowMsg();
									resumeAutosaveTimer();	
								}
							}
						} else 
						if (!retryCounter || retryCounter < maxRetryCounter) {
							if (!retryCounter) retryCounter = 0;
							retryCounter++;
							if (!quiet || quiet == 'timeisup') barShowMessage(renderS(lset(9265), {retryCounter: retryCounter}),4000);
							retrySaveTimeout = setTimeout(function() {
								//saveResult(doneFunc, forceSkoncil, retryCounter);
								saveResult0(scoreData, doneFunc, retryCounter, forceSkoncil, quiet)
							}, 4000);
						} else {														
							if (!quiet || quiet == 'timeisup') {
								errorSavingDlg(doneFunc, forceSkoncil);
							} else {
								if (doneFunc) doneFunc();
							}
						}
					} else {
						somethingChanged = false;
						isInactivePlayerWindow = false;						
						opts.vysledokid = data.vysledokid;

						if (materialObj.setAnswersSaved) materialObj.setAnswersSaved(currentVariantid);

						if (opts.afterSaveResultFunc) {
							opts.afterSaveResultFunc(data.vysledokid);
						}
						
						if (data.clearAnswerLog) {
							answerLogByWidget = {};							
						}
						if (data.unsecuredData) {							
							for (var cardid in data.unsecuredData) {
								var awsData = data.unsecuredData[cardid];
								var qw = materialObj.getCardWidget(cardid);
								var aws = qw.getAnswerWidgets();
								for (var i=0;i<aws.length;i++) {
									var aw = aws[i];
									aw.setUnsecuredData(awsData['aw'+i.toString()]);								
								}
							}
						}
						
						
						if (data.needReload) {
							if (data.reloadAuth) opts.reloadAuth = data.reloadAuth;
							scrollToTopAfterReload = true;
							reload();
						} else
						if (doneFunc) {		
							resumeAutosaveTimer();		
									
							doneFunc(data.scoreData || null);
						}
					}
					if (data && data.ascTester) {
						barShowMessage('Not saved - asc tester');
					}
				},'json').fail(function() {
					
					if (!retryCounter || retryCounter < maxRetryCounter) {
						if (!retryCounter) retryCounter = 0;
						retryCounter++;
						if (!quiet || quiet == 'timeisup') barShowMessage(renderS(lset(9265), {retryCounter: retryCounter}),4000);
						retrySaveTimeout = setTimeout(function() {
							//saveResult(doneFunc, forceSkoncil, retryCounter);
							saveResult0(scoreData, doneFunc, retryCounter, forceSkoncil, quiet)
						}, 4000);
					} else {
						if (loadingElem) loadingElem.hide();
						if (!quiet || quiet == 'timeisup') {
							errorSavingDlg(doneFunc, forceSkoncil);						
						} else {
							if (doneFunc) doneFunc();
						}
					}
				});

				xhr.isErrorHandled = true;
			}			
		}
		var resultSaveError = false;
		function errorSavingDlg(doneFunc, forceSkoncil) {
			resumeAutosaveTimer();
			resultSaveError = true;
			var s = etnl2br(ls(9266));
			barShowMessageBox(s, 'fa-warning', {
				buttons: [
					{label: ls(9267), cssClass: 'button-green etest-btn-fw-confirm', ind: 3},					
					{label: ls(1038), cssClass: 'button-gray etest-btn-fw-confirm', ind: 1},
				],
				buttonClick: function(ind) {				
					if (ind == 1) {
					} else if (ind == 3) {
						saveResult(doneFunc, forceSkoncil, 0);
					} else if (ind == 2) {
						barShowMessageBox('fixme','fa-warning');
					}
				}
			});
		}

		function overrideAnotherWindowDlg(saveFunc) {
			if (isFinished) {
				showResult({anotherEplidResultBar: true});
			}
			var s = '<b>'+lset(2315)+'</b>: '+etnl2br(ls(10310));
			barShowMessageBox(s, 'fa-warning', {
				okLbl: ls(7230),
				confirm: function() {
					isInactivePlayerWindow = false;
					if (saveFunc) {
						saveFunc();
					}
				}
			});
		}

		function getTestDuration() {
			if (isFinished && finishedDuration !== false) {
				return finishedDuration;
			}
			return Math.round((getCurrentTime().getTime() - playTimeStart)/1000)
		}

		function getResultsScoreStr(scoreData) {
			var s = '';
			s += '{#8353} <b style="font-size:1.2em">{scoreStr}%</b>.';

			if (scoreData.hasOwnProperty('bonusPoints')) {
				var ss = '';
				ss += '<div class="etest-player-resultbar-score-desc">';
					ss += '<div><span>- {#10933}:</span><span><b>{sc.scoreSum}</b> / {sc.scoreMax}</span></div>';
					ss += '<div><span>- {#10934}:</span><span><b>{sc.bonusPoints}</b> ({info})</span></div>';
					ss += '<div><span>- {#10935}:</span><span><b>{sc.totalPoints}</b></span></div>';
				ss += '</div>';
				s += renderS(ss, {
					sc: scoreData,
					info: scoreData.bonusApplicable ? Math.floor(scoreData.remainingTime / 60)+' '+ls(9466) : ls(10936)
				});
			} else {
				var ss = '';
				ss += '<div class="etest-player-resultbar-score-desc">';
					ss += '<div><span>- {#3480}:</span> <b>{scscoreSum}</b> / {scscoreMax}</div>';										
				ss += '</div>';
				s += renderS(ss, {
					sc: scoreData,
					scscoreMax: Math.round(scoreData.scoreMax*100)/100,
					scscoreSum: Math.round(scoreData.scoreSum*100)/100,
					info: scoreData.bonusApplicable ? Math.floor(scoreData.remainingTime / 60)+' '+ls(9466) : ls(10936)
				})
			}

			s = renderS(s, {
				scoreStr: scoreData.scorePercent.toFixed(1),
			})
			return s;
		}
		
		
		function showResult(options) {
			if (!options) options = {};
			
			
			if (options.scoreData) {
				lastSavedResultScoreData = options.scoreData || null;
			}

			if (screenWidget.props.cardsPerScreen == 'single') {
				scrollToTopAfterReload = true;
				actionFuncs.switchScreenMode('all');
				return;
			}
							
			contentElem.find('.etest-player-restore-answers-elem').remove();
			contentElem.find('.etest-player-override-epl-elem').remove();
			mainElem.toggleClass('etest-player-result',true);
			mainWidget.setShowCorrectAnswers(/*isContestMode() ? false : */superObj.zobrazovatSpravne('l2'));

			var scoreData = options.scoreData ? options.scoreData : (lastSavedResultScoreData ? lastSavedResultScoreData : materialObj.getScoreData(currentVariantid, {countNotEvaluated: true, duration: getTestDuration()}));

			if (scoreData && scoreData.odpovedexml && scoreData.odpovedexml.values) {
				materialObj.setAnswered(scoreData.odpovedexml.values, scoreData.odpovedexml.variant, scoreData.seenData);
			}
			
			screenWidget.setFinished();
			evaluateAllCards(true);
			
				
			if (screenWidget.props.cardsPerScreen == 'single') {
				actionFuncs.switchScreenMode('all');
				return;
			}
			
			var needTeacherEvaluation = false;
			if (scoreData.questionsTotal > scoreData.questionsEvaluatedAuto && materialObj.getAllElaborationWidgets().length > 0) {
				needTeacherEvaluation = true;	
			}
			
			
			var znamka = scoreData.isDefined && !needTeacherEvaluation ? superObj.computeZnamka(scoreData.scorePercent) : '';
			
			var sd = '';
			var s = '';		
			
			
				
			if (options.anotherEplidResultBar) {	
				s += '<div class="etest-player-resultbar" style="background-color:#7B1FA2;margin-top:-53px;top:40px;position:sticky;margin-bottom:53px;">';
					s += '<div class="etest-player-resultbar-inner" style="max-width: 100%">';		
						s += ls(10326);
						
						s += '<div style="text-align: '+ertl('left','right')+';margin-top:15px;" class="etest-result-button">';													
						//	s += '<a class="flat-button flat-button-graym actionButton" data-action="close">{#1567}</a> ';												
						s += '</div>';

					s += '</div>';
					s += '<div style="clear:both"></div>';
				s += '</div>';

				screenWidget.element.toggleClass('savedInAnotherEplid',true);	
			} else {
				screenWidget.element.toggleClass('savedInAnotherEplid',false);	
				s += '<div class="etest-player-resultbar">';
					if (znamka && superObj.zobrazovatSkore('l2')) {
						s += '<div class="etest-player-resultbar-grade">{znamka}</div>';
					} else {
						s += '<div class="etest-player-resultbar-bg">';
						s += '</div>';
					}
					
					
					s += '<div class="etest-player-resultbar-inner">';					
						s += '<div>';
							if (isTestMeCardsMode()) {
								if (materialObj.materialData && materialObj.materialData.name) {
									s += '<h1 style="margin-bottom:15px;">';									
									s += et(materialObj.materialData.name);
									s += '</h1>';
								}

								if (opts.testScore) {
									s += '<div style="font-size:0.85em;opacity: 0.6;margin-bottom:15px;display:inline-block;">';
										s += getResultsScoreStr(opts.testScore);
									s += '</div>';
								} else {
									s += '<div style="font-size:0.85em;opacity: 0.6;margin-bottom:15px;">';
										s += 'Skontrolujte si VaĹˇe odpovede ';
									s += '</div>';
								}
							} else {
								if (isContestMode()) {
									if (materialObj.materialData && materialObj.materialData.name) {
										s += '<div style="font-size:0.9em;opacity: 0.7;margin-bottom:8px;">';
										s += opts.playerName ? et(opts.playerName)+ ' Â· ' : '';
										s += et(materialObj.materialData.name);
										s += '</div>';
									}
								}
								if (isContestMode() && !superObj.zobrazovatSkore('l2')) {								
									s += 'VaĹˇe odpovede boli zaznamenanĂ©. ÄŽakujeme.';
								} else
								if (needTeacherEvaluation) {
									s += ls(8352);
								} else 
								if (!superObj.zobrazovatSkore('l2')) {
									s += '{#9021}';
						
								} else {
									
									s += getResultsScoreStr(scoreData);

								}

								if (isContestMode() && opts.resultDalsieDotaznikyMsg) {
									s += '<div style="margin: 16px 0">';
									s += 'Na strĂˇnke <a href="https://www.anonymnydotaznik.sk" style="color:inherit">www.anonymnydotaznik.sk</a> sĂş pre VĂˇs pripravenĂ© ÄŹalĹˇie dotaznĂ­ky.';
									s += ' Viete ich teraz, alebo aj neskĂ´r vyplniĹĄ. StaÄŤĂ­ pouĹľiĹĄ rovnakĂ˝ kĂłd, akĂ˝ bol pouĹľitĂ˝ pre vyplnenie prĂˇve dokonÄŤenĂ©ho dotaznĂ­ka.';
									s += '</div>';
								}
							}
						s += '</div>';

						
						s += '<div style="margin-top:15px;" class="etest-result-button">';
						
							s += '<a class="flat-button flat-button-graym actionButton" data-action="close">{#1567}</a> ';
							if (isTestMePlayTestMode()) {

							} else					
							if (materialObj.isTestMeMode()) {
								if (opts.mode2 == 'testMe') {
									if (opts.testmeAgainFunc) {
										s += '<a class="flat-button flat-button-green actionButton" data-action="testMeAgain">{#8354}</a> ';
										sd += '<a class="etest-screen-action-btn flat-button flat-button-green actionButton" data-action="testMeAgain">{#8354}</a>';
									}
								} else {									
									s += '<a class="flat-button flat-button-green actionButton" data-action="testMeAgain">{#8354}</a> ';
									sd += '<a class="etest-screen-action-btn flat-button flat-button-green actionButton" data-action="testMeAgain">{#8354}</a>';
								}
							} else if (!isContestMode() && superObj.superRow && (superObj.superRow.max_pokusov === '0' || !superObj.superRow.max_pokusov || opts.pocetPokusov+1 < superObj.superRow.max_pokusov)
										) {
								s += '<a class="flat-button flat-button-blue actionButton" data-action="testMeAgain">{#9267}</a> ';
								sd += '<a class="etest-screen-action-btn flat-button flat-button-blue actionButton" data-action="testMeAgain">{#9267}</a>';
							}

							if (opts.markAsDoneFunc) {
								s += '<a class="flat-button flat-button-green actionButton" data-action="markAsDone">{#10083}</a> ';
								sd += '<a class="etest-screen-action-btn flat-button flat-button-green actionButton" data-action="markAsDone">{#10083}</a>';
							}

						s += '</div>';
					s += '</div>';

					if (opts.resultMode && isContestMode()) {
						s += '<div class="etest-player-resultbar-inner" style="padding-top:8px;padding-bottom:8px;max-width:none;background-color: rgba(0,0,0,0.3)">';
							s += '<b>'+lset(2315)+":</b> "+lset(10989);
						s += '</div>';
					}
					s += '<div style="clear:both"></div>';

				s += '</div>';

				if (isContestMode() && opts.closeExtraHtml) {
					s += opts.closeExtraHtml;
				}
			}
				
			
			s = renderS(s, {
					scoreStr: scoreData.scorePercent.toFixed(1),
					znamka: znamka
				});
			contentElem.find(".etest-player-resultbar").remove();
			
			var elem = $(s).prependTo(screenWidget.element.find('.etest-screen-inner'));
			
			if (isContestMode() && !superObj.zobrazovatSpravne('l2')) {
				contentElem.find('.etest-question').toggleClass('result-hidden', true);
				contentElem.find('.etest-screen-questions').toggleClass('questions-hidden',true);
			} else {
				contentElem.find('.etest-screen-questions').toggleClass('questions-hidden',false);
				contentElem.find('.etest-question').toggleClass('result-hidden', false);
			}
						
			if (options.scrollAnimation !== false) {								
				if (contentElem.scrollParent().closest('body').length>0) {
					contentElem.scrollParent().animate({
						scrollTop: 0
					},200);
				} else {
					$('html, body').animate({
						scrollTop: 0
					},200);
				}
			}
			
			elem.find('.actionButton').click(function() {
				handleActionButton(this);				
			});	
			
			
			
			var qws = materialObj.getCardWidgets(currentVariantid);
			
			for (var i=0;i<qws.length;i++) {
				var w = qws[i];
				if (w.isSkipped) {
					w.setSkippedView(true);
				} else {					
					w.setCorrectView(w.needTeacherEvaluation() ? 'needEvaluation' : (w.isSomethingAnswered() ? w.isAllCorrect() : 'notanswered'));
				}
			}
			
			screenWidget.element.toggleClass('resultbarVisible',true);		
			screenWidget.createActionButtons();
			var elemD = $('<span>'+renderS(sd,{})+'</span>').appendTo(screenWidget.element.find('.etest-screen-actions'));
			
			elemD.find('.actionButton').click(function() {
				
				handleActionButton(this);				
			});	
			$(window).resize();

			createSideElem(cardWidgetsById);
			
		}
		
		function fullScreenElement() {
			return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
		}
		
		function fullScreenChangeHandle(e) {
			var isFullScreen = fullScreenElement();
			
			if ((materialObj && materialObj.etestType == ETestUtils.etestTypePresentation)) {
				mainElem.toggleClass('fullScreenMode',!!isFullScreen);
			}

			if (interactiveElems["fullScreenIcon"]) {
				interactiveElems["fullScreenIcon"].html(isFullScreen ? '&#xE5D1;' : '&#xE5D0;');
			}

			if (interactiveElems["fullScreenBtn"]) {
				interactiveElems["fullScreenBtn"].attr('title',isFullScreen ? ls(11798) : ls(11797)).attr('aria-label',isFullScreen ? ls(11798) : ls(11797));
			}

			$(window).resize();

			if (!fullScreenElement()) {
				addAnswerLogEvent(e.target, "FULLSCREEN_EXIT");							
			} else {
				addAnswerLogEvent(e.target, "FULLSCREEN_ENTER");					
			}
			handleWindowEnforcement();
		}
		
		var forceClose = false;
		function canSimplyClosePlayer() {				
			if (isOfflineView) return true;				
			if (isFinished) return true;
			if (opts.interactivePreviewMode) return true;
			if (opts.odovzdavanieMode && !somethingChanged) return true;
			if (forceClose) {
				return true;
			}

			if (window.etestPlayerSkipPageLeave) {
				window.etestPlayerSkipPageLeave = false;
				return true;
			}

			if (planSaveTimeout) {
				return false;
			}

			if (materialObj && materialObj.isTestMeMode()) {
				var answerWidgets = materialObj.getAllAnswerWidgets();
				for (var i=0;i<answerWidgets.length;i++) {
					var w = answerWidgets[i];		
					if (!w.isEvaluated() && w.isSomethingAnswered()) return false;
				}
				return true;
			}

			if (materialObj && materialObj.isSomethingAnswered()) return false;

			if ((materialObj && materialObj.etestType == ETestUtils.etestTypePresentation)
				|| (playTimeStart && ((new Date()).getTime() - playTimeStart) < 10*1000)) {
				
				return true;
			}
			return false;
		}
	    
	    var actionFuncs = {};
	    actionFuncs.save = function() {
	    	save();
		}
		
		actionFuncs.markAsDone = function() {
			if (opts.markAsDoneFunc) {
				opts.markAsDoneFunc(function() {
					actionFuncs.close();
				});
			}
		}
	    
	    actionFuncs.playerClose = function(elem) {			
			
	    	publicActions.playerClose();
	    }
	    
	    actionFuncs.close = function(skipSave) {			
			stopTime(true);
			
			if (skipSave !== true 
				&& !opts.previewMode
				&& !isFinished 
				&& !isWaiting
				&& isSeenOnlyMode()) {
													
				saveResult(function() {
					actionFuncs.closeContinue();
				});
			} else {
				actionFuncs.closeContinue();
			}
		}

		actionFuncs.closeContinue = function() {
	    	$(window).off('beforeunload.etestplayer');
	    	if (fullScreenElement()) {            		
            	if (document.cancelFullScreen) {
					document.cancelFullScreen();
				} else if (document.mozCancelFullScreen) {
					document.mozCancelFullScreen();
				} else if (document.webkitCancelFullScreen) {
					document.webkitCancelFullScreen();
				}         		
        	}
        	    	
	    	var returnElem = mainElem.closest('.etest-return-div');
	    	if (returnElem.length == 0) {
	    		barToggleEdubarHeader(!wasEdubarHidden);
	    		barToggleSideBar(!wasEdubarHidden);	    		
	    	}
	 	    		    	
	    	var returnFunc = returnElem.data('returnFunc');	    	
	    	
	    	if (opts.closeFunc) {
				
	    		if (returnFunc) {
	    			returnFunc();
	    		}    		
	    		opts.closeFunc.call(mainElem, {somethingChanged: somethingChanged, somethingSaved: somethingSaved});
	    		return;    	
	    	} else 
	    	if (returnFunc) {
	    		returnFunc();
	    		return;
	    	} else if (MobileAppBridge.isActive()) {
			
	    		MobileAppBridge.runFlexMethod('close', {});
	    		return;
	    	} 
	    	
	    	
	    	if (isContestMode() || opts.closeurl) {
				window.location = opts.closeurl || 'https://onlineolypiady.sk/';
			} else 
	    	if (opts.superid) {
	    		barSmartLoadPage(barEncLink('/elearning/?cmd=ETestCreator&cspohladStart=tests&superid='+opts.superid));
	    	} else {
	    		barSmartLoadPage(barEncLink('/elearning/?cmd=ETestCreator&cspohladStart=tests'));
	    	}
	    	
	    }
	    
	    actionFuncs.launchFullScreen = function() {
	    	if (fullScreenElement()) {            		
            	if (document.cancelFullScreen) {
					document.cancelFullScreen();
				} else if (document.mozCancelFullScreen) {
					document.mozCancelFullScreen();
				} else if (document.webkitCancelFullScreen) {
					document.webkitCancelFullScreen();
				}         		
        	} else {
		    	var element = $('html').get(0);	    	
				if (element.requestFullScreen) {
					element.requestFullScreen();
				} else if(element.mozRequestFullScreen) {
					element.mozRequestFullScreen();
				} else if(element.webkitRequestFullScreen) {
					element.webkitRequestFullScreen();		
				} else if(element.msRequestFullscreen) {
					element.msRequestFullscreen();		
				}
			}
		}
		
		actionFuncs.openSideMenu = function() {
			toggleSideElem();
		}
		
		actionFuncs.gotoQuestion = function(elem) {
			var ind = $(elem).attr('data-ind');			
			screenWidget.setCurrentQuestion(ind*1);
		}
		
		actionFuncs.switchScreenMode = function(elem) {
			//if (materialObj.isSecured && !isFinished) return;
			var mode = typeof elem == 'string' ? elem : $(elem).attr('data-mode');
			if (!materialObj.materialData["options"])  materialObj.materialData["options"] = {};
			if (!materialObj.materialData["options"]["screenProps"]) materialObj.materialData["options"]["screenProps"]= {};
			materialObj.materialData["options"]["screenProps"].cardsPerScreen = mode;
			screenWidget.props.cardsPerScreen = mode;
			answersValues = null;
			if (!isFinished) {
				var answerWidgets = materialObj.getAllAnswerWidgets();
				for (var i=0;i<answerWidgets.length;i++) {
					var aw = answerWidgets[i];
					aw._evaluated = false;
					aw._evaluated1 = false;
				}
			}
			createContent();
		}
		
		actionFuncs.submit = function(elem) {
			handleSubmit();
		}
		actionFuncs.saveResult = function(elem) {
			handleSaveResult();
			if (sideElem.is(':visible')) {
				toggleSideElem();
			}
		}
		
		actionFuncs.testMeAgain = function(elem) {
			if (isSecureMode()) {
				opts.vysledokRow = null;
				opts.vysledokid = '';	
				opts.securedStart = null;
				answersData = null;
				answersValues = null;	
				answerLogByWidget = {};
				reload();
			} else if (opts.testmeAgainFunc) {
				actionFuncs.close();
				opts.testmeAgainFunc();			
			} else {				
				opts.vysledokRow = null;
				opts.vysledokid = '';	
				answersData = null;
				answersValues = null;	
				answerLogByWidget = {};	
				reload();
				/*playTimeStart = 0;
				if (loadingElem) loadingElem.show();
				ETestMaterial.createByDownload(opts, function(mobj, data) {
					materialObj = mobj;
					initProperties(data);
					initData1();
				}, function() {				
					creteOfflineView();	
				});*/
			}
		}
		
		actionFuncs.answerQuestionAgain = function(elem) {			
			var qw = screenWidget.getCurrentQuestionWidget();
			if (qw) {
				qw.answerAgain();
			}
			
			if (sideElem.is(':visible')) {
				toggleSideElem();
			}
		}

		actionFuncs.openBlackboard = function(elem) {
			var cardids = materialObj.getCardids();						
			barNewDialog({
				source: '/bb/?cmd=BBCreate',
				postData: {
					cardids: cardids.join(';'),
					planid: ''
				},
				dialogClass: 'grayTitleDialog noPadding',
				title: 'Play on blackboard',
				width: 650,
				returnFunc: function() {
				
				}
			});
			//ETestUtils.bbPlayCardids(cardids, 'append');
		}

		actionFuncs.showLocalResults = function(elem) {
			
			getLocalStorageResults(function(results1) {
				getLocalStorageResults0(function(results0) {
					var results = [];
					for (var i=0;i<results1.length;i++) {
						results.push(results1[i]);
					}
					for (var i=0;i<results0.length;i++) {
						results0[i].id = 'r0_'+i;
						results.push(results0[i]);
					}
					var s = '';
					s += '<div style="padding:15px">';
						s += '<div style="margin-bottom: 10px;"><b>'+lset(9268)+':</b></div>';
						s += '<div>';
						if (results.length == 0) {
							s += '<div style="padding: 16px 0;opacity: 0.5;">'+lset(8309)+'</div>';
						}
						for (var i=0;i<results.length;i++) {
							var r = results[i];
							var ss = '';

							ss += '<div class="etest-answers-restore-item" style="position:relative">';						
								ss += (new Date(r.ts)).format('d.m.Y H:i:s');
								
								if (isWaiting) {
									ss += '<a class="actionButton" data-action="restoreAndSaveLocalResult" data-ind="{ind}" data-id="{r.id}">{#6894}</a>';
									//ss += '<a class="actionButton" data-action="showLocalResult" data-ind="{ind}" style="color:inherit;position:absolute;top:5px;right:0"><i class="fa fa-fw fa-code"></i></a>';
								} else {
									ss += '<a class="actionButton" data-action="restoreLocalResult" data-ind="{ind}" data-id="{r.id}">{#6894}</a>';
								}
							ss += '</div>';

							s += renderS(ss, {
								ind: i,
								r: r
							});
						}
						s += '</div>';
					
						s += '<div style="text-align:'+ertl('right','left')+';padding-top:10px;">';
							s += '<input type="button" class="button-gray" onclick="barCloseDialog(this)" value="'+lset(1567)+'">';
						s += '</div>';
					s += '</div>';

					var dlg = barNewDialog({
						content: s,
						dialogClass: 'whiteDialog noPadding',
						width: 400
					});

					dlg.find('.actionButton').on('click',function(e) {
						handleActionButton(this, e);
					});
				});
			});
		}

		actionFuncs.showLocalResult = function(elem) {
			var ind = $(elem).attr('data-ind');
			getLocalStorageResults(function(results) {
				var r = results[ind];		
				barShowMessageBox('<pre>'+et(JSON.stringify(r,null,' '))+'</pre>','fa-info',{
					title: 'EduPage'
				});
			});
		}

		actionFuncs.restoreAndSaveLocalResult = function(elem) {
			barShowMessageBox(ls(9274),'fa-question',{
				confirm: function() {
					var ind = $(elem).attr('data-ind');
					var id = $(elem).attr('data-id');
					getLocalStorageResultData(id, function(r) {						
						var scoreData = $.extend({},r.data);
						scoreData.isRestored = true;
						scoreData.isRestoredTs = (new Date(r.ts)).format('Y-m-d H:i:s');
						saveResult0(scoreData, function() {
							barCloseDialog(elem);
							barShowMessage('Result was restored. Please notify your teacher.')
						});
									
					});
				}
			});		
		}
		actionFuncs.restoreLocalResult = function(elem) {
			barShowMessageBox(ls(9274),'fa-question',{
				confirm: function() {
					var ind = $(elem).attr('data-ind');
					var id = $(elem).attr('data-id');
					getLocalStorageResultData(id, function(r) {		
						answersData = r.data;
						if (answersData && answersData.odpovedexml && answersData.odpovedexml.values) {
							answersValues = answersData.odpovedexml.values;
							currentVariantid = answersData.odpovedexml.variant ? answersData.odpovedexml.variant : 0;
						}						
						if (answersData && answersData.seenData) {
							seenData = answersData.seenData;
						}				
						
						//isFinished = r.data.skoncil; 
						materialObj = new ETestMaterial(opts.materialData);
							
						initData1(true);
						barCloseDialog(elem);
						if (sideElem.is(':visible')) {
							toggleSideElem();
						}
					});
				}
			});			
		}

		actionFuncs.restoreRestorableAnswersData = function(elem) {
			if (!restorableAnswersData) return;
			barShowMessageBox(ls(9274),'fa-question',{
				confirm: function() {
					answersData = restorableAnswersData.data;
					restorableAnswersData = null;
					contentElem.find('.etest-player-restore-answers-elem').remove();
					if (answersData && answersData.odpovedexml && answersData.odpovedexml.values) {
						answersValues = answersData.odpovedexml.values;
						currentVariantid = answersData.odpovedexml.variant ? answersData.odpovedexml.variant : 0;
					}
					if (answersData && answersData.seenData) {
						seenData = answersData.seenData;
					}						
					
					materialObj = new ETestMaterial(opts.materialData);
					
					initData1(true);
				}
			});
		}


		actionFuncs.cancelRestorableAnswers = function(elem) {
			restorableAnswersData = null;
			contentElem.find('.etest-player-restore-answers-elem').remove();
			$(window).resize();
		}

		actionFuncs.cancelOverrideEplid = function() {
			contentElem.find('.etest-player-override-epl-elem').remove();
			$(window).resize();
		}

		actionFuncs.reportQuestion = function() {
			toggleSideElem();

			var qw = screenWidget.getCurrentQuestionWidget();
			ETestUtils.openCardPropsEditor([qw.getCardid()]);
		}

		actionFuncs.overrideEplId = function() {
			if (isFinished) {
				return;
			}
			
			saveResult(function() {
				contentElem.find('.etest-player-override-epl-elem').remove();
			}, false, 0, false, true);
		}

		actionFuncs.submitAgain = function() {
			saveResult(function() {
				showResult();
			}, true)
		}

		actionFuncs.resultExpandAll = function() {			
			contentElem.find('.etest-question.contentHidden').find('.etest-question-number').click();
			toggleSideElem();
		}

		actionFuncs.resultCollapseAll = function() {
			contentElem.find('.etest-question:not(.contentHidden)').find('.etest-question-number').click();
			toggleSideElem();
		}
			
		
		
		var _confirmCloseDlg = null;
		var publicActions = {};
		publicActions.gotoQuestion = function(data) {
			screenWidget.setCurrentQuestion(ind*1);
		}

		publicActions.loadData = function(data) {
			initProperties(data);
			initData();
		}

		publicActions.getCurrentQuestionIndex = function() {
			return screenWidget.getCurrentQuestion();
		}

		publicActions.playerClose = function() {
			if (canSimplyClosePlayer()) {
				if (opts.odovzdavanieMode) { 
					barShowMessageBox('Test vieĹˇ otvoriĹĄ aj opakovane, aĹľ do termĂ­nu konca sĂşĹĄaĹľe.', 'fa-info',{
						okLbl: ls(9180),
						confirm: function() {
							actionFuncs.close();
						}
					})
				} else {
					actionFuncs.close();
				}
				return;
			}
			
			if (_confirmCloseDlg) {
				_confirmCloseDlg.dialog('close');
				_confirmCloseDlg = null;
				return;
			}


			if (materialObj && materialObj.isSomethingAnswered()) {
				//nemame ulozene vysledky
				var buttons = [];
				if (isTestMeMode()) {
					buttons.push({label: ls(8670), cssClass: 'button-red etest-dialog-btn-fw', ind: 3});			
				} else if (opts.odovzdavanieMode) {
					buttons.push({label: ls(1529), cssClass: 'button-blue etest-dialog-btn-fw', ind: 4});
					buttons.push({label: ls(4187), cssClass: 'button-red etest-dialog-btn-fw', ind: 3});					
				} else 
				if (!opts.onlySubmitMode && ETestUtils.isProjectMode(materialObj.etestType)) {
					buttons.push({label: ls(8887), cssClass: 'button-green etest-dialog-btn-fw', ind: 2});
					buttons.push({label: ls(8888), cssClass: 'button-blue etest-dialog-btn-fw', ind: 4});
					buttons.push({label: ls(8670), cssClass: 'button-red etest-dialog-btn-fw', ind: 3});
				} else {
					buttons.push({label: opts.onlySubmitMode ? ls(11677) : ls(8669), cssClass: 'button-green etest-dialog-btn-fw', ind: 2});
					buttons.push({label: ls(8670), cssClass: 'button-red etest-dialog-btn-fw', ind: 3});
				}
				
				buttons.push({label: ls(1038), cssClass: 'etest-dialog-btn-fw', ind: 1});

				_confirmCloseDlg = barShowMessageBox(isTestMeMode() ? 'You have not evaluated answers, do you really want to exit?' : ls(8668),'fa-question', {
					buttons: buttons,
					buttonClick: function(ind) {
						if (ind == 1) {
							
						} else if (ind == 2) {
							if (materialObj.cardsOnlyMode && !isTestMePlayTestMode()) {
								materialObj.setSkippedUnanswered();
							}							
							handleSubmit();
						} else if (ind == 3) {
							forceClose = true;
							actionFuncs.close();
						} else if (ind == 4) {
							saveResult(function() {
								actionFuncs.close();
							}, false, 0, false, true);
						}						
					},
					close: function() {
						_confirmCloseDlg = null;
					}
				});

			} else {


				_confirmCloseDlg = barShowMessageBox(ls(8328),'fa-question', {
					confirm: function() {
						actionFuncs.close();
					},
					close: function() {
						_confirmCloseDlg = null;
					}
				});
			}
		}
		
		
		
		
    	mainElem.data('publicActions', publicActions);
    	if (MobileAppBridge.isActive()) {
    		
    		MobileAppBridge.registerBackHandler(mainElem, function() {    			
    			publicActions.playerClose();
    		});
			MobileAppBridge.registerJsFunctions(publicActions);			
			MobileAppBridge.runFlexMethod('playerRegistered',{});
			setTimeout(function() {
				initProperties(opts);
				initData();
			}, 100)			
		} else {

			initProperties(opts);
			initData();
			
		}
   	
    }    
    return this.each(main);
};

$.fn.etestPlayer.defaults = {	    	
	closeFunc: null,
	completedFunc: null,
	formurl: '/elearning/?cmd=MaterialPlayer'
};
        
}(jQuery));
