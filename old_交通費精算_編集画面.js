// 交通費申請　編集画面（バックアップ：ブラックリスト方式）
$p.events.on_editor_load = function () {

    //#region<定数定義>
    // =========================================================================
    // 【設定エリア】
    // =========================================================================
    const CLASS_REQUESTDATE = 'DateA';  //「申請日」欄
    const CLASS_MANFIXDATE = 'DateB';  //「承認日(上長)」欄
    const CLASS_GAFIXDATE = 'DateC';  //「承認日(総務部)」欄
    const CLASS_SUPERIOR = 'ClassB'; //「上長」欄  
    const CLASS_GAID = 'ClassC'; //「承認者」欄
    const CLASS_USER = 'ClassA'; //「申請者」欄
    const CLASS_CREATOR = 'ClassD'; //「作成者」欄

    const GAS_TRANSREPO_URL = 'https://script.google.com/macros/s/AKfycbwv_UdDOkIvyVcz_oAj-1odo4yEWD013cKTs4u3bxXhB0qPvWwS_qAE-ZyKL4SQDh_Q/exec';
    const CHILD_TABLE_ID = 15339887;   
    const LINK_COLUMN_NAME = 'ClassI'; 
    const PARENT_USER_COLUMN = 'ClassA'; 

    // ステータスID定義
    const STATUS_CREATING = '作成中'; // 作成中
    const STATUS_REJECT = '差し戻し'; //差し戻し中
    const STATUS_UNDERREV = '決済待ち';//決済待ち
    const STATUS_COMPLETED = '完了'; // 完了

    const FIELD_MAP = {
        date:        'StartTime',
        destination: 'Title',
        dep:         'ClassA',
        arr:         'ClassB',
        way:         'ClassD',
        trip:        'ClassH',
        amount:      'NumA',
        memo:        'Body',
        approvedDate: 'DateB'
    };

    //「従業員一覧」テーブル
    const WORKERTABLE_ID = 15337991;
    const WORKERTABLE_CLASS_USER = "ClassQ"; //「ユーザーID」項目
    //自分と上長の「従業員一覧」レコード情報
    let myEmployeeDataPromise = null;
    let supEmployeeDataPromise = null;

    // 「お気に入り経路」テーブル
    const FAV_TABLE_ID = 15951290;  // ★お気に入りテーブルID
    // お気に入りマスタのユーザーID項目
    const FAV_USER_COL = 'ClassD'; 

    //「経路履歴」テーブル
    const HIST_TABLE_ID = 15960204;
    const HIST_USER_COL = 'ClassD'; // お気に入りマスタのユーザーID項目
    const HIST_REGISTQTY = 5; //経路履歴最大保存件数

    //経路候補一覧関連
    const PAGE_SIZE = 5;            // 1ページに表示する件数

    // =========================================================================
    //指定項目読み取り専用化
    $p.getControl(CLASS_MANFIXDATE).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});    //承認日(上長)
    $p.getControl(CLASS_GAFIXDATE).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});    //承認日(総務部)
    $p.getControl(CLASS_GAID).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});    //承認者(総務部)
    
    //現在のステータス取得
    const currentStatus = $p.getControl('Status').text();
    //#endregion

    //#region<関数定義>
    // ▼Promise化用のヘルパー関数
    const apiGetAsync = (jsonfile) => {
        return new Promise((resolve, reject) => {
            jsonfile.done = function(data) { resolve(data); };
            jsonfile.fail = function(data) { reject(data); };
            $p.apiGet(jsonfile);
        });
    };

    // 更新用のヘルパー関数
    const apiUpdateAsync = (id, data) => {
        return new Promise((resolve, reject) => {
            $p.apiUpdate({
                id: id,
                data: data,
                done: function(data) { resolve(data); },
                fail: function(data) { reject(data); }
            });
        });
    };

    const apiDeleteAsync = (id) => {
        return new Promise((resolve, reject) => {
            $p.apiDelete({
                id: id,
                done: function(data) { resolve(data); },
                fail: function(data) { reject(data); }
            });
        });
    };

    function formatDate(dateStr) {
        if (!dateStr) return "";
        var date = new Date(dateStr);
        if (isNaN(date.getDate())) return dateStr; 
        return (date.getMonth() + 1) + '/' + date.getDate();
    }
    
    //自分の「従業員一覧」レコード取得
    const getMyEmployeeData = async () => {
        if (!myEmployeeDataPromise) return null;
        return await myEmployeeDataPromise;
    };

    //上長の「従業員一覧」レコード取得
    const getSupEmployeeData = async () => {
        if (!supEmployeeDataPromise) return null;
        return await supEmployeeDataPromise;
    };
    //#endregion

    //#region<「従業員一覧」テーブル情報取得(自分＆上長)>
    (async () => {
        try {
            //自分の情報を取得
            myEmployeeDataPromise = apiGetAsync({
                id: WORKERTABLE_ID,
                data: {
                    View: {
                        ColumnFilterHash: {
                            [WORKERTABLE_CLASS_USER]: JSON.stringify([String($p.userId())])
                        }
                    }
                }
            }).then(result => {
                if (result.Response.Data.length > 0) {
                    return result.Response.Data[0];
                }
                return null;
            });
            const supId = $p.getControl(CLASS_SUPERIOR).val();
            supEmployeeDataPromise = apiGetAsync({
                id: supId
            }).then(result => {
                if (result.Response.Data.length > 0) {
                    return result.Response.Data[0];
                }
                return null;
            });

            const myData = await myEmployeeDataPromise;
            const supData = await supEmployeeDataPromise;

        } catch (e) {
            console.error("初期データ取得に失敗", e);
        }
    })();
    //#endregion

    //#region<申請者or作成者かつ作成中or差し戻しでないときのアクセス制御>
    // ---------------------------------------------------------------
    // ▼ ブラックリスト方式：条件外なら削除・無効化する
    // ---------------------------------------------------------------
    (async () => {
        // 1. 判定用データの準備
        const myEmpData = await getMyEmployeeData();
        const myEmpRecordId = myEmpData ? String(myEmpData.ResultId) : null; 
        
        const applicantId = $p.getControl(CLASS_USER).val();    
        const creatorId   = $p.getControl(CLASS_CREATOR).val(); 
        const currentUserId = String($p.userId());              
        
        const statusText = $p.getControl('Status').text();      

        // 2. 条件判定
        const isAuthorizedUser = (myEmpRecordId === applicantId) || (currentUserId === creatorId);
        const isEditableStatus = (statusText === STATUS_CREATING || statusText === STATUS_REJECT);
        const canEditChild = isAuthorizedUser && isEditableStatus;

        console.log(`DEBUG: Child Access Check -> UserOK:${isAuthorizedUser}, StatusOK:${isEditableStatus}, Result:${canEditChild}`);

        // 3. 編集不可なら各種入力機能を無効化・削除
        if (!canEditChild) {
            
            // (A) 入力支援パネル（経路候補一覧）を非表示にする
            $('#CustomRouteContainer').remove();

            // (B) OCR読取ボタンとファイル入力を非表示にする
            $('#BtnOcrRead').remove();
            $('#OcrFileInput').remove();

            // (C) 子レコード一覧のアクセス制御（リンク遷移不可にする）
            const disableChildLinks = () => {
                const $table = $('table[data-id="' + CHILD_TABLE_ID + '"]');
                if ($table.length > 0) {
                    const $tbody = $table.find('tbody');
                    $tbody.find('tr').css({
                        'pointer-events': 'none',
                        'color': '#999',
                        'background-color': '#f9f9f9'
                    });
                    $tbody.find('a').css('pointer-events', 'none');
                    return true;
                }
                return false;
            };

            let retryCount = 0;
            const lockTimer = setInterval(() => {
                $('#CustomRouteContainer').remove();
                $('#BtnOcrRead').remove();
                disableChildLinks();
                retryCount++;
                if (retryCount > 20) clearInterval(lockTimer); 
            }, 500);
        }
    })();
    //#endregion

    //#region<作成者自動入力>
    if($p.getControl(CLASS_CREATOR).val() === ''){
        console.log("DEBUG: Input Creator ID: " + $p.userId());
        $p.set($p.getControl(CLASS_CREATOR), $p.userId());
    }
    //#endregion

    //#region<承認日、承認者入力>
    if(currentStatus === STATUS_UNDERREV && $p.getControl(CLASS_MANFIXDATE).val() === ''){
        const today = new Date();
        const todayyear = today.getFullYear();
        const todaymonth = today.getMonth() + 1;
        const todaydate = today.getDate();
        $p.set($p.getControl(CLASS_MANFIXDATE), todayyear + '/' + todaymonth + '/' + todaydate);
    }
    else if(currentStatus !== STATUS_UNDERREV && currentStatus !== STATUS_COMPLETED && $p.getControl(CLASS_MANFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_MANFIXDATE), '');
    }

    if(currentStatus === STATUS_COMPLETED && $p.getControl(CLASS_GAFIXDATE).val() === ''){
        const today = new Date();
        const todayyear = today.getFullYear();
        const todaymonth = today.getMonth() + 1;
        const todaydate = today.getDate();
        $p.set($p.getControl(CLASS_GAFIXDATE), todayyear + '/' + todaymonth + '/' + todaydate);

        let userId = $p.userId();
        $p.apiGet({
            id: WORKERTABLE_ID,
            data: { View: { "ColumnFilterHash": { [WORKERTABLE_CLASS_USER]: "[\"" + userId + "\"]" } } },
            done: function (data) {
                if (data.Response.Data && data.Response.Data.length > 0) {
                    let userIdOnWorkerTable = data.Response.Data[0].ResultId;
                    $p.set($p.getControl(CLASS_GAID), userIdOnWorkerTable);
                } 
            },
            fail: function(data){ alert('通信が失敗しました'); }
        });
    }
    else if(currentStatus !== STATUS_COMPLETED && $p.getControl(CLASS_GAFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_GAFIXDATE), '');
    }
    //#endregion

    //#region<既存ボタンのリネーム・装飾・制御>
    var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
    if ($targetBtn.length > 0) {
        $targetBtn.contents().filter(function() { return this.nodeType === 3; }).replaceWith(' 交通費情報を入力するにはこちらをクリック');

        if (currentStatus !== STATUS_CREATING && currentStatus !== STATUS_REJECT) {
            var $disabledBtn = $targetBtn.clone(false).removeAttr('onclick');
            $disabledBtn.css({ 'background-color': '#dcdcdc', 'border-color': '#cccccc', 'color': '#888888', 'font-weight': 'bold', 'padding': '5px 15px', 'cursor': 'not-allowed', 'background-image': 'none' });
            $disabledBtn.on('click', function(e) { e.preventDefault(); alert("現在は承認依頼済み、または完了ステータスのため、情報の入力はできません。"); });
            $targetBtn.hide().after($disabledBtn);
        } 
        else if ($p.getControl(CLASS_CREATOR).val() !== String($p.userId())) {
            var $disabledBtn = $targetBtn.clone(false).removeAttr('onclick');
            $disabledBtn.css({ 'background-color': '#dcdcdc', 'border-color': '#cccccc', 'color': '#888888', 'font-weight': 'bold', 'padding': '5px 15px', 'cursor': 'not-allowed', 'background-image': 'none' });
            $disabledBtn.on('click', function(e) { e.preventDefault(); alert("作成者以外は情報の入力はできません。"); });
            $targetBtn.hide().after($disabledBtn);
        } 
        else {
            $targetBtn.css({ 'background-color': '#0056b3', 'background-image': 'none', 'border-color': '#004494', 'color': '#ffffff', 'font-weight': 'bold', 'padding': '5px 15px' });
        }
    }
    //#endregion

    //#region<子レコード並び替え機能（順次更新版）> ※現段階では実装中止
    /*
    // =========================================================================
    // ▼ 子レコード（交通費申請レコード）のドラッグ&ドロップ並び替え
    //   ・429エラー対策：1件ずつ順番に更新するロジックに変更
    // =========================================================================
    
    // 定数定義
    const CHILD_TABLE_ID_SORT = 15339887; // 子テーブルID
    const SORT_COL_NAME = 'NumB';         // 連番を格納する項目名（精算書内データNo）

    // ▼ 待機用関数 (ミリ秒)
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ▼ ソート機能を適用する関数
    const initSortableTable = () => {
        const $table = $('table[data-id="' + CHILD_TABLE_ID_SORT + '"]');
        if ($table.length === 0) return false;

        const $tbody = $table.find('tbody');
        if ($tbody.hasClass('ui-sortable')) return true;

        $tbody.sortable({
            cursor: "move", axis: "y", opacity: 0.8,
            helper: function(e, tr) {
                var $originals = tr.children();
                var $helper = tr.clone();
                $helper.children().each(function(index) { $(this).width($originals.eq(index).width()); });
                return $helper;
            },
            update: async function(event, ui) {
                $table.css('opacity', '0.5').css('pointer-events', 'none');
                console.log("DEBUG: Saving new order (Sequentially)...");
                try {
                    let updateTasks = [];
                    $tbody.find('tr').each(function(index) {
                        const rowId = $(this).data('id'); const newNum = index + 1;
                        if (rowId) updateTasks.push({ id: rowId, num: newNum });
                    });
                    for (const task of updateTasks) {
                        await $p.apiUpdate({
                            id: task.id,
                            data: { NumHash: { [SORT_COL_NAME]: task.num } }
                        });
                        await sleep(100);
                    }
                    console.log("DEBUG: Order saved successfully.");
                } catch (e) {
                    console.error("Sort update failed:", e);
                    if (e.status === 429) alert("通信が混み合っており保存できませんでした。");
                    else alert("並び替えの保存に失敗しました。");
                } finally {
                    $table.css('opacity', '1').css('pointer-events', 'auto');
                }
            }
        }).disableSelection();
        $tbody.find('tr').css('cursor', 'move').attr('title', 'ドラッグして並び替え');
        return true;
    };

    let sortInitRetryCount = 0;
    const sortInitTimer = setInterval(() => {
        if (initSortableTable() || sortInitRetryCount > 20) clearInterval(sortInitTimer);
        sortInitRetryCount++;
    }, 500);
    */
    //#endregion

    //#region<精算書PDF出力>
    if($p.action() !== 'new'){
        $('#MainCommands').append('<button id="BtnPrintPdfParent" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-document"></span>PDF出力</button>');
    }
    $('#BtnPrintPdfParent').on('click', async function() {
        var parentId = $p.id();
        if (!parentId) { alert('レコードが保存されていません。'); return; }
        var userName = $p.getControl(PARENT_USER_COLUMN).find('option:selected').text().trim();
        if (!userName) userName = $p.getControl(PARENT_USER_COLUMN).text().trim();
        userName = userName.split(")")[1];

        if (!confirm('以下の条件でPDFを出力しますか？\n\n・対象：紐付いている全明細\n・利用者：' + userName)) return;

        try {
            var result = await apiGetAsync({
                id: CHILD_TABLE_ID,
                data: { View: { ColumnFilterHash: { [LINK_COLUMN_NAME]: JSON.stringify([String(parentId)]) }, ColumnSorterHash: { [FIELD_MAP.date]: 'asc' } } }
            });
            var records = result.Response.Data;
            if (records.length === 0) { alert('データがありません。'); return; }

            var sendDataList = [];
            records.forEach(function(row) {
                sendDataList.push({
                    "id": row.IssueId, "date": formatDate(row[FIELD_MAP.date]), "requestdate": $p.getControl(CLASS_REQUESTDATE).text(),
                    "user": userName, "destination": row[FIELD_MAP.destination], "dep": row[FIELD_MAP.dep], "arr": row[FIELD_MAP.arr],
                    "way": row[FIELD_MAP.way], "trip": row[FIELD_MAP.trip], "amount": row[FIELD_MAP.amount], "memo": row[FIELD_MAP.memo]
                });
            });

            $.ajax({
                type: 'POST', url: GAS_TRANSREPO_URL, contentType: 'text/plain', data: JSON.stringify(sendDataList),
                success: function(response) {
                    try {
                        var resJson = (typeof response === 'object') ? response : JSON.parse(response);
                        if (resJson.pdfBase64) {
                            var bin = atob(resJson.pdfBase64); var buffer = new Uint8Array(bin.length);
                            for (var i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
                            var pdfUrl = window.URL.createObjectURL(new Blob([buffer.buffer], { type: "application/pdf" }));
                            window.open(pdfUrl, '_blank');
                        } else { alert("処理完了: " + resJson.message); }
                    } catch(e) { alert("レスポンスエラー"); }
                },
                error: function() { alert("送信に失敗しました。"); }
            });
        } catch (e) { console.error(e); alert('エラーが発生しました。'); }
    });
    //#endregion

    //#region<経路呼び出し機能（埋め込みパネル版）>
    let cachedFavRecords = null;
    var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');

    if ($p.action() !== 'new' && $targetBtn.length > 0) {
        // 重複防止
        $('#CustomRouteContainer').remove();

        const panelHtml = `
            <div id="CustomRouteContainer" style="clear: both; margin-top: 20px;">
                <h4 id="RoutePanelHeader" style="margin-bottom: 5px; font-weight: bold; color: #333; cursor: pointer; user-select: none;">
                    <span id="RoutePanelToggleIcon" class="ui-icon ui-icon-circle-minus" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>経路候補一覧
                </h4>
                <div id="EmbeddedRoutePanel" style="border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9; border-radius: 4px;">
                    <div id="RouteTabs" style="font-size: 0.9em; background: transparent; border: none;">
                        <ul><li><a href="#tab-history">利用経路履歴</a></li><li><a href="#tab-fav">お気に入り経路</a></li></ul>
                        <div id="tab-history" style="min-height: 150px; padding: 10px 0;"><p id="hist-loading-msg" style="color:#666; margin:10px;">（タブをクリックして読み込み）</p></div>
                        <div id="tab-fav" style="min-height: 150px; padding: 10px 0; border-top: none;"><p id="fav-loading-msg" style="color:#666; margin:10px;">（タブをクリックして読み込み）</p></div>
                    </div>
                </div>
                <h4 style="margin-top: 30px; margin-bottom: 10px; font-weight: bold; color: #333; border-bottom: 2px solid #0056b3; padding-bottom: 5px; width: 100%;">
                    <span class="ui-icon ui-icon-note" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>登録中の交通費情報
                </h4>
            </div>
        `;

        // ★挿入場所の特定（重複バグ対策済みロジック）
        let $anchor = $targetBtn.filter(':visible');
        if ($anchor.length === 0) $anchor = $targetBtn.next(); 
        if ($anchor.length === 0) $anchor = $targetBtn;
        $anchor.last().after(panelHtml);

        const loadHistoryData = async () => {
            const $histContainer = $('#tab-history');
            const currentUserId = $p.userId();
            const SESSION_KEY_HIST = 'TrafficApp_History';
            let historyList = [];
            const sessionData = sessionStorage.getItem(SESSION_KEY_HIST);
            let needsApiFetch = true;
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                if (parsed.userId === currentUserId && parsed.data) {
                    historyList = parsed.data;
                    if(parsed.data.length > 0) needsApiFetch = false;
                }
            }
            if (needsApiFetch) {
                $histContainer.html('<p style="padding:10px;">履歴を取得中...</p>');
                try {
                    const result = await apiGetAsync({
                        id: HIST_TABLE_ID,
                        data: { View: { ColumnFilterHash: { [HIST_USER_COL]: JSON.stringify([String(currentUserId)]) }, ColumnSorterHash: { CreatedTime: 'desc' } }, PageSize: 10 }
                    });
                    historyList = result.Response.Data || [];
                    sessionStorage.setItem(SESSION_KEY_HIST, JSON.stringify({ userId: currentUserId, data: historyList }));
                } catch (e) { $histContainer.html('<p style="color:red; margin:10px;">失敗</p>'); return; }
            }
            $histContainer.empty();
            if (historyList.length === 0) { $histContainer.html('<p style="color:#666; margin:10px;">履歴なし</p>'); } 
            else {
                let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th style="width:70px;"></th><th style="width:200px;">日付</th><th style="width:200px;">経路</th><th style="width:80px;">金額</th><th>備考</th></tr></thead><tbody>';
                historyList.slice(0, PAGE_SIZE).forEach(r => {
                    const copyData = { ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumC: r.NumA, ClassE: $p.getControl('ClassA').val(), ClassC: $p.getControl('ClassB').val(), ClassI: String($p.id()), _mode: 'copy' };
                    const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                    tableHtml += `<tr><td style="text-align:center;"><button class="select-route-btn" data-json="${jsonStr}">選択</button></td><td>${r.DateA?new Date(r.DateA).toLocaleDateString():'-'}</td><td>${(r.ClassA||'')+'→'+(r.ClassB||'')}</td><td>${(r.NumA||0).toLocaleString()}円</td><td>${r.Body||''}</td></tr>`;
                });
                tableHtml += '</tbody></table>';
                $histContainer.html(tableHtml);
            }
        };

        const renderFavPage = (page) => {
            const $favContainer = $('#tab-fav');
            if (!cachedFavRecords || cachedFavRecords.length === 0) { $favContainer.html('<p style="color:#666; margin:10px;">なし</p>'); return; }
            const limit = PAGE_SIZE; const totalCount = cachedFavRecords.length; const totalPages = Math.ceil(totalCount / limit);
            if(page > totalPages) page = totalPages; if(page < 1) page = 1;
            const startIndex = (page - 1) * limit;
            const displayRecords = cachedFavRecords.slice(startIndex, startIndex + limit);
            
            let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th></th><th>名称</th><th>経路</th><th>金額</th><th></th></tr></thead><tbody>';
            displayRecords.forEach(r => {
                const copyData = { Title: r.Title, ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumC: r.NumA, Body: r.Body, ClassE: $p.getControl('ClassA').val(), ClassC: $p.getControl('ClassB').val(), ClassI: String($p.id()), _mode: 'copy' };
                tableHtml += `<tr><td><button class="select-route-btn" data-json="${JSON.stringify(copyData).replace(/"/g, '&quot;')}">選択</button></td><td>${r.Title}</td><td>${(r.ClassA||'')+'→'+(r.ClassB||'')}</td><td>${(r.NumA||0).toLocaleString()}円</td><td><button class="delete-fav-btn" data-id="${r.IssueId||r.ResultId||r.Id}" data-page="${page}">×</button></td></tr>`;
            });
            tableHtml += '</tbody></table>';
            if(totalPages > 1) {
                const prevD = page===1?'disabled':''; const nextD = page===totalPages?'disabled':'';
                tableHtml += `<div style="text-align:center;"><button class="fav-page-nav" data-page="${page-1}" ${prevD}>&lt;</button> ${page}/${totalPages} <button class="fav-page-nav" data-page="${page+1}" ${nextD}>&gt;</button></div>`;
            }
            $favContainer.html(tableHtml);
        };

        const fetchAllFavData = async () => {
            try {
                const result = await apiGetAsync({ id: FAV_TABLE_ID, data: { View: { ColumnFilterHash: { [FAV_USER_COL]: JSON.stringify([String($p.userId())]) }, ColumnSorterHash: { UpdatedTime: 'desc' } }, PageSize: 1000 } });
                cachedFavRecords = result.Response.Data || [];
                renderFavPage(1);
            } catch (e) { $('#tab-fav').html('エラー'); }
        };

        $('#RouteTabs').tabs({ activate: function(event, ui) {
            if (ui.newPanel.attr('id') === 'tab-history') loadHistoryData();
            else if (ui.newPanel.attr('id') === 'tab-fav') { if(cachedFavRecords === null) fetchAllFavData(); else renderFavPage(1); }
        }});
        loadHistoryData();

        $('#RoutePanelHeader').on('click', function() { $('#EmbeddedRoutePanel').slideToggle(200); });
        $(document).off('click', '.fav-page-nav').on('click', '.fav-page-nav', function() { renderFavPage($(this).data('page')); });
        $(document).off('click', '.delete-fav-btn').on('click', '.delete-fav-btn', async function() {
            if(confirm("削除しますか？")) { await apiDeleteAsync(String($(this).data('id'))); cachedFavRecords=cachedFavRecords.filter(r=>String(r.IssueId||r.ResultId||r.Id)!==String($(this).data('id'))); renderFavPage($(this).data('page')); }
        });
        $(document).off('click', '.select-route-btn').on('click', '.select-route-btn', function() {
            const data = $(this).data('json'); data.ParentId = $p.id();
            sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(data));
            window.location.href = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + LINK_COLUMN_NAME + '=' + data.ParentId;
        });
    }
    //#endregion

    //#region<画像OCR読込機能>
    if ($p.action() !== 'new') {
        $('#BtnOcrRead').remove();
        const ocrBtnHtml = `<button id="BtnOcrRead" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px;"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-image"></span>画像から交通費情報を読取(OCR)</button><input type="file" id="OcrFileInput" accept="image/png, image/jpeg" style="display:none;">`;
        let $anchorBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
        if($anchorBtn.length > 0) {
            let $visibleBtn = $anchorBtn.filter(':visible');
            if($visibleBtn.length > 0) $visibleBtn.last().after(ocrBtnHtml); else $anchorBtn.last().after(ocrBtnHtml);
        }
    }
    $(document).on('click', '#BtnOcrRead', function(e) { e.preventDefault(); $('#OcrFileInput').val(''); $('#OcrFileInput').click(); });
    $(document).on('change', '#OcrFileInput', function() {
        const file = this.files[0]; if(!file) return;
        const $btn = $('#BtnOcrRead'); const orig = $btn.html(); $btn.prop('disabled', true).html('解析中...');
        const reader = new FileReader();
        reader.onload = function(e) {
            $.ajax({ type: 'POST', url: GAS_TRANSREPO_URL, data: JSON.stringify({ type: 'ocr', imageBase64: e.target.result }), contentType: 'text/plain', dataType: 'json',
                success: function(res) { $btn.prop('disabled', false).html(orig); if(res.error) {alert(res.message); return;} showOcrModal(Array.isArray(res)?res:[res]); },
                error: function(x,s,e) { $btn.prop('disabled', false).html(orig); alert('通信失敗'); }
            });
        };
        reader.readAsDataURL(file);
    });
    
    const showOcrModal = (list) => {
        $('#OcrResultDialog').remove();
        let h = ''; list.forEach(r => h+=`<tr><td><input type="checkbox" class="ocr-check" data-json="${JSON.stringify(r).replace(/"/g,'&quot;')}" checked></td><td>${r.date}</td><td>${r.dep}→${r.arr}</td><td>${Number(r.amount).toLocaleString()}</td></tr>`);
        $('body').append(`<div id="OcrResultDialog" title="確認"><table class="grid"><thead><tr><th><input type="checkbox" id="OcrAll" checked></th><th>日付</th><th>経路</th><th>金額</th></tr></thead><tbody>${h}</tbody></table></div>`);
        $('#OcrResultDialog').dialog({ modal:true, width:700, buttons: { "決定": function(){ procOcr(); $(this).dialog("close"); }, "キャンセル": function(){ $(this).dialog("close"); } } });
        $('#OcrAll').on('change', function() { $('.ocr-check').prop('checked', $(this).prop('checked')); });
    };
    const procOcr = () => {
        const q=[]; $('.ocr-check:checked').each(function(){ const r=$(this).data('json'); q.push({StartTime:r.date, ClassA:r.dep, ClassB:r.arr, ClassD:r.way, NumA:r.amount, Body:r.memo, ParentId:$p.id(), ClassE:$p.getControl('ClassA').val(), ClassC:$p.getControl('ClassB').val(), ClassI:String($p.id()), _mode:'ocr'}); });
        if(q.length===0)return;
        sessionStorage.setItem('TrafficApp_OcrQueue', JSON.stringify(q)); sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(q.shift()));
        window.location.href = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + LINK_COLUMN_NAME + '=' + $p.id();
    };
    //#endregion
};