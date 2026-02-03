// 交通費申請　編集画面
$p.events.on_editor_load = function () {

    //#region<定数定義>
    // =========================================================================
    // 【設定エリア】
    // =========================================================================
    const CLASS_REQUESTDATE = 'DateA';  //「申請日」
    const CLASS_MANFIXDATE = 'DateB';  //「承認日(上長)」
    const CLASS_GAFIXDATE = 'DateC';  //「承認日(総務部)」
    const CLASS_SUPERIOR = 'ClassB'; //「上長」(User ID)
    const CLASS_GAID = 'ClassC'; //「承認者」(User ID)
    const CLASS_USER = 'ClassA'; //「申請者」(User ID)
    const CLASS_CREATOR = 'ClassD'; //「作成者」(User ID)

    const GA_DEPT_NAME = '総務管理部';  
    
    const GAS_TRANSREPO_URL = 'https://script.google.com/macros/s/AKfycbwv_UdDOkIvyVcz_oAj-1odo4yEWD013cKTs4u3bxXhB0qPvWwS_qAE-ZyKL4SQDh_Q/exec';
    const CHILD_TABLE_ID = 15339887;   
    const LINK_COLUMN_NAME = 'ClassI'; 
    const PARENT_USER_COLUMN = 'ClassA'; 
    
    //ログインユーザーの権限判定用
    //------------------------------------------------------------------------------
    // 現在のユーザーIDなどは同期的に取れるのでここで確定してOK
    const currentUserId = String($p.userId()); 
    /*
    const applicantId = String($p.getControl(CLASS_USER).val() || ''); 
    const creatorId   = String($p.getControl(CLASS_CREATOR).val() || '');
    const superiorId  = String($p.getControl(CLASS_SUPERIOR).val() || '');
    // 同期的に判定できるものはここで計算
    let myDept = '';
    let isApplicant = isApplicant = (currentUserId === applicantId) || (currentUserId === creatorId);
    let isSuperior = (superiorId !== '' && currentUserId === superiorId);
    let isGeneralAffairs = false;
    */
    //------------------------------------------------------------------------------
    

    // ステータスID定義
    const STATUS_CREATING = '作成中'; 
    const STATUS_REJECT = '差し戻し'; 
    const STATUS_APPROVAL = '承認待ち';
    const STATUS_UNDERREV = '決済待ち';
    const STATUS_COMPLETED = '完了'; 

    //「交通費精算レコード」テーブル
    const TRAFREC_CLASS_DATANO = 'NumB'; //「清算書内データNo」欄
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
    const WORKERTABLE_CLASS_USER = "ClassQ"; 
    const WORKERTABLE_CLASS_DEPT = "ClassB"; 

    // 「お気に入り経路」テーブル
    const FAV_TABLE_ID = 15951290;
    const FAV_USER_COL = 'ClassD'; 
    const FAV_FIELD_MAP = {
        title:       'Title',
        destination: 'ClassE',
        dep:         'ClassA',
        arr:         'ClassB',
        way:         'ClassC',
        amount:      'NumA',
        memo:        'Body'
    };

    //「経路履歴」テーブル
    const HIST_TABLE_ID = 15960204;
    const HIST_USER_COL = 'ClassD'; 
    const HIST_REGISTQTY = 5; 

    const PAGE_SIZE = 5; 

    // =========================================================================
    // 指定項目読み取り専用化
    const setReadOnlyStyle = (selector) => {
        $p.getControl(selector).prop('readonly', true).css({
            'pointer-events': 'none',
            'background-color': '#fff', 
            'cursor': 'default'
        });
    };
    setReadOnlyStyle(CLASS_MANFIXDATE);
    setReadOnlyStyle(CLASS_GAFIXDATE);
    setReadOnlyStyle(CLASS_GAID);
    
    // 現在のステータス取得
    const currentStatus = $p.getControl('Status').text();
    //#endregion

    //#region<関数定義>
    const apiGetAsync = (jsonfile) => {
        return new Promise((resolve, reject) => {
            jsonfile.done = function(data) { resolve(data); };
            jsonfile.fail = function(data) { reject(data); };
            $p.apiGet(jsonfile);
        });
    };
    const apiUpdateAsync = (id, data) => {
        return new Promise((resolve, reject) => {
            $p.apiUpdate({ id: id, data: data, done: function(data) { resolve(data); }, fail: function(data) { reject(data); } });
        });
    };
    const apiDeleteAsync = (id) => {
        return new Promise((resolve, reject) => {
            $p.apiDelete({ id: id, done: function(data) { resolve(data); }, fail: function(data) { reject(data); } });
        });
    };
    function formatDate(dateStr) {
        if (!dateStr) return "";
        var date = new Date(dateStr);
        if (isNaN(date.getDate())) return dateStr; 
        return (date.getMonth() + 1) + '/' + date.getDate();
    }



    //子レコードの並び順を現在の見た目通りに更新する共通関数
    const updateChildOrder = async () => {
        const $rows = $(`table[data-id="${CHILD_TABLE_ID}"] tbody tr`);
        if ($rows.length === 0) return true; // 対象なしなら成功とみなす

        let updatePromises = [];
        let needUpdate = false;

        $rows.each(function (index) {
            const $row = $(this);
            const recordId = $row.data('id'); 
            if (!recordId) return;

            const correctNo = index + 1;
            // 無条件でUpdateリストに入れる
            updatePromises.push(
                apiUpdateAsync(recordId, { [TRAFREC_CLASS_DATANO]: correctNo })
            );
            needUpdate = true;
        });

        if (needUpdate) {
            console.log("DEBUG: Updating child order...");
            $('#MainContainer').css('opacity', '0.5'); // 処理中表示
            try {
                await Promise.all(updatePromises);
                console.log("DEBUG: Child order updated.");
                return true;
            } catch (e) {
                console.error("並び替え更新エラー", e);
                alert("明細の並び順更新に失敗しました。");
                return false;
            } finally {
                $('#MainContainer').css('opacity', '1.0');
            }
        }
        return true;
    };
    //#endregion

    //#region<UI構築関数>
    const initInputSupportUI = ($targetBtn) => {
        if ($targetBtn.length === 0) return;

        //#region<<経路選択パネル>>
        // --- 1. 経路選択パネル ---
        if ($('#CustomRouteContainer').length === 0) {
            let cachedFavRecords = null;
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
                </div>`;
            
            let $anchor = $targetBtn.filter(':visible');
            if ($anchor.length === 0) $anchor = $targetBtn.next(); 
            if ($anchor.length === 0) $anchor = $targetBtn;
            $anchor.last().after(panelHtml);

            // 履歴データ読込 (User IDを使用)
            const loadHistoryData = async () => {
                const $histContainer = $('#tab-history');
                //const currentUserId = $p.userId();
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
                            data: {
                                View: {
                                    ColumnFilterHash: { [HIST_USER_COL]: JSON.stringify([String(currentUserId)]) },
                                    ColumnSorterHash: { CreatedTime: 'desc' }
                                },
                                PageSize: 10
                            }
                        });
                        historyList = result.Response.Data || [];
                        sessionStorage.setItem(SESSION_KEY_HIST, JSON.stringify({ userId: currentUserId, data: historyList }));
                    } catch (e) {
                        $histContainer.html('<p style="color:red; margin:10px;">履歴の読み込みに失敗しました。</p>');
                        return;
                    }
                }
                
                $histContainer.empty();
                if (historyList.length === 0) {
                    $histContainer.html('<p style="color:#666; margin:10px;">履歴はありません。</p>');
                } else {
                    let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th style="width:70px;"></th><th>日付</th><th>経路</th><th>金額</th><th>備考</th></tr></thead><tbody>';
                    const limit = 5;
                    historyList.slice(0, limit).forEach(r => {
                        const routeDesc = (r.ClassA || '') + ' → ' + (r.ClassB || '') + ' <span style="color:#666;">(' + (r.ClassC || '-') + ')</span>'; 
                        const copyData = {
                            ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumC: r.NumA, 
                            ClassE: $p.getControl(CLASS_USER).val(), ClassC: $p.getControl(CLASS_SUPERIOR).val(), 
                            ClassI: String($p.id()), _mode: 'copy'
                        };
                        const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                        let dateStr = r.DateA ? new Date(r.DateA).toLocaleDateString() : '-';
                        tableHtml += `<tr style="border-bottom:1px solid #eee;"><td style="text-align:center; padding: 5px;"><button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button></td><td style="padding: 5px;">${dateStr}</td><td style="padding: 5px;">${routeDesc}</td><td style="text-align:right; padding: 5px;">${(r.NumA || 0).toLocaleString() + "円"}</td><td style="padding: 5px;">${r.Body || ''}</td></tr>`;
                    });
                    tableHtml += '</tbody></table>';
                    $histContainer.html(tableHtml);
                }
            };

            const renderFavPage = (page) => {
                const $favContainer = $('#tab-fav');
                if (!cachedFavRecords || cachedFavRecords.length === 0) {
                    $favContainer.html('<p style="color:#666; margin:10px;">登録済みのお気に入り経路はありません。</p>');
                    return;
                }
                const limit = (typeof PAGE_SIZE !== 'undefined') ? PAGE_SIZE : 5;
                const totalCount = cachedFavRecords.length;
                const totalPages = Math.ceil(totalCount / limit);
                if (page > totalPages) page = totalPages; if (page < 1) page = 1;
                const startIndex = (page - 1) * limit;
                const displayRecords = cachedFavRecords.slice(startIndex, startIndex + limit);

                let tableHtml = 
                '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="padding:5px;">名称</th><th style="padding:5px;">行先</th><th style="padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="width:30px; padding:5px;"></th></tr></thead><tbody>';

                displayRecords.forEach(r => {
                    const recordId = r.IssueId || r.ResultId || r.Id;
                    const routeDesc = (r.ClassA || '') + ' → ' + (r.ClassB || '') + ' <span style="color:#666;">(' + (r.ClassC || '-') + ')</span>';
                    const copyData = { 
                        Title: r[FAV_FIELD_MAP.destination], 
                        ClassA: r.ClassA, 
                        ClassB: r.ClassB, 
                        ClassD: r.ClassC, 
                        NumC: r.NumA, 
                        Body: r.Body, 
                        ClassE: $p.getControl(CLASS_USER).val(), 
                        ClassC: $p.getControl(CLASS_SUPERIOR).val(), 
                        ClassI: String($p.id()), 
                        _mode: 'copy' 
                    };
                    const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                    tableHtml += 
                    `<tr style="border-bottom:1px solid #eee;">
                        <td style="text-align:center; padding: 5px;">
                            <button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" 
                            style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button>
                        </td>
                        <td style="padding: 5px;">${r.Title}</td>
                        <td style="padding: 5px;">${r.ClassE}</td>
                        <td style="padding: 5px;">${routeDesc}</td>
                        <td style="text-align:right; padding: 5px;">${(r.NumA || 0).toLocaleString()  + "円"}</td>
                        <td style="text-align:center; padding: 5px;">
                            <button type="button" class="delete-fav-btn ui-button ui-corner-all ui-widget" style="padding: 1px 6px; font-size: 11px; color: white; 
                            background-color: #d9534f; border: 1px solid #d43f3a; border-radius: 3px;" title="削除" data-id="${recordId}" data-page="${page}">×</button>
                        </td>
                    </tr>`;
                });
                tableHtml += '</tbody></table>';
                
                if (totalPages > 1) {
                    const prevDisabled = (page === 1) ? 'disabled style="opacity:0.5; cursor:default;"' : '';
                    const nextDisabled = (page === totalPages) ? 'disabled style="opacity:0.5; cursor:default;"' : '';
                    tableHtml += `<div style="text-align: center; margin-top: 10px; padding: 5px; border-top: 1px dashed #ddd;"><button type="button" class="fav-page-nav ui-button ui-corner-all ui-widget" data-page="${page - 1}" ${prevDisabled}>&lt; 前へ</button><span style="margin: 0 15px; font-weight:bold;">${page} / ${totalPages}</span><button type="button" class="fav-page-nav ui-button ui-corner-all ui-widget" data-page="${page + 1}" ${nextDisabled}>次へ &gt;</button></div>`;
                }
                $favContainer.html(tableHtml);
            };

            const fetchAllFavData = async () => {
                const $favContainer = $('#tab-fav');
                $favContainer.html('<p style="padding:10px;">データを取得中...</p>');
                try {
                    const result = await apiGetAsync({
                        id: FAV_TABLE_ID,
                        data: { View: { ColumnFilterHash: { [FAV_USER_COL]: JSON.stringify([String($p.userId())]) }, ColumnSorterHash: { UpdatedTime: 'desc' } }, PageSize: 1000 }
                    });
                    cachedFavRecords = result.Response.Data || [];
                    renderFavPage(1);
                } catch (e) {
                    $favContainer.html('<p style="color:red; margin:10px;">データの読み込みに失敗しました。</p>');
                }
            };

            $('#RouteTabs').tabs({
                activate: function(event, ui) {
                    const panelId = ui.newPanel.attr('id');
                    if (panelId === 'tab-history') loadHistoryData();
                    else if (panelId === 'tab-fav') { if (cachedFavRecords === null) fetchAllFavData(); else renderFavPage(1); }
                }
            });
            loadHistoryData();

            $('#RoutePanelHeader').on('click', function() {
                var $panel = $('#EmbeddedRoutePanel');
                var $icon = $('#RoutePanelToggleIcon');
                $panel.slideToggle(200, function() {
                    if ($panel.is(':visible')) $icon.removeClass('ui-icon-circle-plus').addClass('ui-icon-circle-minus');
                    else $icon.removeClass('ui-icon-circle-minus').addClass('ui-icon-circle-plus');
                });
            });
            $(document).off('click', '.fav-page-nav').on('click', '.fav-page-nav', function() {
                const newPage = $(this).data('page');
                if (newPage) renderFavPage(newPage);
            });
            $(document).off('click', '.delete-fav-btn').on('click', '.delete-fav-btn', async function() {
                if (!confirm("本当に削除しますか？")) return;
                try {
                    await apiDeleteAsync(String($(this).data('id')));
                    cachedFavRecords = cachedFavRecords.filter(r => String(r.IssueId || r.ResultId || r.Id) !== String($(this).data('id')));
                    renderFavPage($(this).data('page'));
                } catch (e) { alert("削除に失敗しました。"); }
            });
            $(document).off('click', '.select-route-btn').on('click', '.select-route-btn', function() {
                const data = $(this).data('json');
                data.ParentId = $p.id();
                sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(data));
                window.location.href = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + LINK_COLUMN_NAME + '=' + data.ParentId;
            });
        }
        //#endregion

        //#region<<OCRボタン>>
        // --- 2. OCRボタン ---
        if ($('#BtnOcrRead').length === 0) {
            const ocrBtnHtml = `<button id="BtnOcrRead" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px;"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-image"></span>画像から交通費情報を読取(OCR)</button><input type="file" id="OcrFileInput" accept="image/png, image/jpeg" style="display:none;">`;
            if($targetBtn.length > 0) {
                let $visibleBtn = $targetBtn.filter(':visible');
                if($visibleBtn.length > 0) $visibleBtn.last().after(ocrBtnHtml);
                else $targetBtn.last().after(ocrBtnHtml);
            }
            $(document).on('click', '#BtnOcrRead', function(e) { e.preventDefault(); $('#OcrFileInput').val(''); $('#OcrFileInput').click(); });
            $(document).on('change', '#OcrFileInput', function() {
                const file = this.files[0]; if (!file) return;
                const $btn = $('#BtnOcrRead'); const originalText = $btn.html();
                $btn.prop('disabled', true).html('<span class="ui-icon ui-icon-clock"></span>解析中...');
                const reader = new FileReader();
                reader.onload = function(e) {
                    const base64Data = e.target.result;
                    const payload = { type: 'ocr', imageBase64: base64Data };
                    $.ajax({
                        type: 'POST', url: GAS_TRANSREPO_URL, data: JSON.stringify(payload), contentType: 'text/plain', dataType: 'json',
                        success: function(response) {
                            $btn.prop('disabled', false).html(originalText);
                            if (response.status === 'error' || response.error) { alert('OCRエラー: ' + (response.message || '詳細不明')); return; }
                            showOcrResultModal(Array.isArray(response) ? response : [response]);
                        },
                        error: function(xhr, status, error) {
                            $btn.prop('disabled', false).html(originalText);
                            if (xhr.responseText) {
                                try { const maybeJson = JSON.parse(xhr.responseText); if (maybeJson) { showOcrResultModal(Array.isArray(maybeJson) ? maybeJson : [maybeJson]); return; } } catch(e) {}
                            }
                            alert('通信失敗: ' + error);
                        }
                    });
                };
                reader.readAsDataURL(file);
            });

            const showOcrResultModal = (dataList) => {
                $('#OcrResultDialog').remove();
                let rowsHtml = '';
                dataList.forEach((row) => {
                    const amount = row.amount ? Number(row.amount).toLocaleString() : '';
                    const rowJson = JSON.stringify(row).replace(/"/g, '&quot;');
                    rowsHtml += `<tr><td style="text-align:center;"><input type="checkbox" class="ocr-check" data-json="${rowJson}" checked></td><td>${row.date||''}</td><td>${(row.dep||'')+'→'+(row.arr||'')}<br><span style="color:#666;font-size:0.8em;">${row.way||''}</span></td><td style="text-align:right;">${amount}</td><td>${row.memo||''}</td></tr>`;
                });
                const dialogHtml = `<div id="OcrResultDialog" title="読み取り結果の確認"><p>登録する明細を選択してください。</p><table class="grid" style="width:100%; font-size:12px;"><thead><tr><th style="width:30px;"><input type="checkbox" id="OcrCheckAll" checked></th><th style="width:80px;">日付</th><th>経路 / 手段</th><th style="width:60px;">金額</th><th>備考</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
                $('body').append(dialogHtml);
                $('#OcrResultDialog').dialog({
                    modal: true, width: 700, height: 500,
                    buttons: {
                        "決定（連続登録へ）": function() { processOcrSelection(); $(this).dialog("close"); },
                        "キャンセル": function() { $(this).dialog("close"); }
                    }
                });
                $('#OcrCheckAll').on('change', function() { $('.ocr-check').prop('checked', $(this).prop('checked')); });
            };

            const processOcrSelection = () => {
                const queue = []; const parentId = $p.id();
                $('.ocr-check:checked').each(function() {
                    const raw = $(this).data('json');
                    queue.push({
                        StartTime: raw.date, ClassA: raw.dep, ClassB: raw.arr, ClassD: raw.way, NumC: raw.amount, Body: raw.memo,
                        ParentId: parentId, ClassE: $p.getControl('ClassA').val(), ClassC: $p.getControl('ClassB').val(), ClassI: String(parentId), _mode: 'ocr'
                    });
                });
                if (queue.length === 0) { alert("選択されていません。"); return; }
                const firstData = queue.shift();
                sessionStorage.setItem('TrafficApp_OcrQueue', JSON.stringify(queue));
                sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(firstData));
                window.location.href = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + (typeof LINK_COLUMN_NAME !== 'undefined' ? LINK_COLUMN_NAME : 'ClassI') + '=' + parentId;
            };
        }
        //#endregion
    };
    //#endregion

    //#region<メイン処理：アクセス制御とUI構築>
    (async () => {
        //#region<<権限確認>>
        // ---------------------------------------------------------------
        // 1. 情報取得（キャッシュ対応版）
        // ---------------------------------------------------------------
        //const currentUserId = String($p.userId()); // ログインユーザーID
        let myDept = '';

        const SESSION_KEY_MY_DEPT = 'TrafficApp_MyDept_' + currentUserId;
        const cachedDept = sessionStorage.getItem(SESSION_KEY_MY_DEPT);

        if (cachedDept) {
            myDept = cachedDept;
            console.log("DEBUG: Load Dept from Cache: " + myDept);
        } else {
            try {
                const result = await apiGetAsync({
                    id: WORKERTABLE_ID,
                    data: { 
                        View: { 
                            ColumnFilterHash: { [WORKERTABLE_CLASS_USER]: JSON.stringify([currentUserId]) } 
                        } 
                    }
                });
                if (result.Response.Data.length > 0) {
                    myDept = result.Response.Data[0][WORKERTABLE_CLASS_DEPT];
                    sessionStorage.setItem(SESSION_KEY_MY_DEPT, myDept);
                    console.log("DEBUG: Fetch Dept from API & Saved: " + myDept);
                }
            } catch (e) {
                console.error("部署情報の取得に失敗", e);
            }
        }

        // ★ここで共有変数を更新 (asyncの結果を反映)
        //isGeneralAffairs = (myDept === GA_DEPT_NAME);

        // ---------------------------------------------------------------
        // 2. 権限判定
        // ---------------------------------------------------------------

        const applicantId = String($p.getControl(CLASS_USER).val() || ''); 
        const creatorId   = String($p.getControl(CLASS_CREATOR).val() || '');
        const superiorId  = String($p.getControl(CLASS_SUPERIOR).val() || '');
        
        const isApplicant = (currentUserId === applicantId) || (currentUserId === creatorId);
        const isSuperior = (superiorId !== '' && currentUserId === superiorId);
        const isGeneralAffairs = (myDept === GA_DEPT_NAME);
        
        //ステータスチェック
        const st = $p.getControl('Status').text(); 
        const isStatusEdit = (st === STATUS_CREATING || st === STATUS_REJECT);
        const isStatusApproval = (st === STATUS_APPROVAL);
        const isStatusPayment = (st === STATUS_UNDERREV); 
        const isStatusCompleted = (st === STATUS_COMPLETED); 

        console.log(`=== Access Control (User ID Mode) ===`);
        console.log(`Me: ${currentUserId}, Dept: "${myDept}"`);
        console.log(`Target -> App: "${applicantId}", Sup: "${superiorId}"`);
        console.log(`Check -> isApp: ${isApplicant}, isSup: ${isSuperior}, isGA: ${isGeneralAffairs}`);
        console.log(`=====================================`);

        // 3. 権限付与ロジック
        let allowEditFields = false; 
        let showProcessButtons = false; 

        if (isStatusEdit && isApplicant) {
            allowEditFields = true;
            showProcessButtons = true;
        }
        else if (isStatusApproval && isSuperior) {
            allowEditFields = false;
            showProcessButtons = true; 
        }
        else if ((isStatusPayment || isStatusCompleted) && isGeneralAffairs) {
            allowEditFields = false;
            showProcessButtons = true; 
        }
        console.log('allowEditField: ' + allowEditFields + ', showProcessButtons: ' + showProcessButtons);
        //#endregion

        //#region<<権限毎の画面制御>>
        // 4. 画面制御実行
        if (allowEditFields) {
            //$('#' + LOCK_STYLE_ID).remove();
            
            var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
            if ($targetBtn.length > 0) {
                $targetBtn.show();
                $targetBtn.contents().filter(function() { return this.nodeType === 3; }).replaceWith(' 交通費情報を入力するにはこちらをクリック');
                $targetBtn.css({ 'background-color': '#0056b3', 'background-image': 'none', 'border-color': '#004494', 'color': '#ffffff', 'font-weight': 'bold', 'padding': '5px 15px' });
            }
            initInputSupportUI($targetBtn);

        } else {
            $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]').hide();

            const $fields = $('#FieldSetGeneral');
            $fields.find('input, select, textarea').prop('readonly', true);
            $fields.find('input, select, textarea, label').css({
                'pointer-events': 'none',
                'background-color': '#fff', 
                'color': 'inherit',         
                'cursor': 'default'         
            });
            $fields.find('.ui-datepicker-trigger, .ui-icon-close').hide();
        
            $(`table[data-id="${CHILD_TABLE_ID}"] tbody`).on('click', 'tr', function(e) {
                // 明示的に編集を禁止
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            });
            // リンクも無効化
            $(`table[data-id="${CHILD_TABLE_ID}"] tbody a`).on('click', function(e) {
                e.preventDefault();
                return false;
            });
        }

        /*
        if (showProcessButtons) {
            $('#MainCommands button').show();
        }
        */
        if (!showProcessButtons) {
            $('#MainCommands button').hide();
            $('#GoBack').show();
        }
        //#endregion

        //#region<<PDFボタン>>
        // 新規作成以外且つ総務部の場合にPDFボタンを追加する
        if($p.action() !== 'new' && isGeneralAffairs){
            // 一度ボタンがあるか確認して、なければ追加（二重追加防止）
            if ($('#BtnPrintPdfParent').length === 0) {
                $('#MainCommands').append('<button id="BtnPrintPdfParent" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-document"></span>PDF出力</button>');
                
                // クリックイベントの登録もここで行う
                $('#BtnPrintPdfParent').on('click', async function() {
                    var parentId = $p.id();
                    if (!parentId) { alert('レコードが保存されていません。'); return; }
                    var userName = $p.getControl(PARENT_USER_COLUMN).find('option:selected').text().trim();
                    if (!userName) userName = $p.getControl(PARENT_USER_COLUMN).text().trim();

                    if (!confirm('以下の条件でPDFを出力しますか？\n\n・対象：紐付いている全明細\n・利用者：' + userName)) return;

                    try {
                        const sortKey = (typeof TRAFREC_CLASS_DATANO !== 'undefined') ? TRAFREC_CLASS_DATANO : 'NumB';
                        var result = await apiGetAsync({
                            id: CHILD_TABLE_ID,
                            data: { 
                                View: { 
                                    ColumnFilterHash: { [LINK_COLUMN_NAME]: JSON.stringify([String(parentId)]) }, 
                                    ColumnSorterHash: { [sortKey]: 'asc' } 
                                } 
                            }
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
            }
            // 確実に表示
            $('#BtnPrintPdfParent').show();
        }
        //#endregion

    })();
    //#endregion

    //#region<自動入力系（修正済み）>
    if($p.getControl(CLASS_CREATOR).val() === ''){
        $p.set($p.getControl(CLASS_CREATOR), $p.userId());
    }

    if(currentStatus === STATUS_UNDERREV && $p.getControl(CLASS_MANFIXDATE).val() === ''){
        const today = new Date();
        $p.set($p.getControl(CLASS_MANFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
    }
    else if(currentStatus !== STATUS_UNDERREV && currentStatus !== STATUS_COMPLETED && $p.getControl(CLASS_MANFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_MANFIXDATE), '');
    }

    if(currentStatus === STATUS_COMPLETED && $p.getControl(CLASS_GAFIXDATE).val() === ''){
        const today = new Date();
        $p.set($p.getControl(CLASS_GAFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
        $p.set($p.getControl(CLASS_GAID), $p.userId());
    }
    else if(currentStatus !== STATUS_COMPLETED && $p.getControl(CLASS_GAFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_GAFIXDATE), '');
    }
    //#endregion

    //#region <子レコード並び替え & 一括更新機能（軽量化・ID修正版）>
    // =========================================================================
    // ▼ 子テーブルの行をドラッグ＆ドロップで並び替え可能にし、
    //    保存時に「見た目の順番通り」に番号を振り直す処理
    // =========================================================================


    // 1. 並び替えUIの有効化
    const setupSortableChildTable = () => {
        const $childTableBody = $(`table[data-id="${CHILD_TABLE_ID}"] tbody`);
        if ($childTableBody.length === 0) return;

        $childTableBody.sortable({
            cursor: "move",
            axis: "y",
            helper: function(e, tr) {
                const $originals = tr.children();
                const $helper = tr.clone();
                $helper.children().each(function(index) {
                    $(this).width($originals.eq(index).width());
                });
                return $helper;
            },
            update: function(event, ui) { }
        }).disableSelection();
    };

    // 2. 保存前処理
    let isChildUpdating = false; 

    $p.events.before_send = function (args) {
        // (A) ボタンの特定処理（軽量化）
        let $sender = null;

        if (args && args.sender) {
            $sender = args.sender;
        } 
        else {
            const $active = $(document.activeElement);
            if ($active.is('button') || $active.hasClass('button')) {
                $sender = $active;
            }
        }

        if (!$sender || $sender.length === 0) {
            $sender = $('#UpdateCommand');
        }

        console.log("DEBUG: Sender identified as -> " + ($sender ? $sender.attr('id') : 'Unknown'));

        // --- 判定ロジック ---

        if ($sender && ($sender.attr('id') === 'DeleteCommand' || $sender.attr('name') === 'Delete')) {
            //console.log("DEBUG: Skip sort update (Delete button).");
            return true;
        }

        if (isChildUpdating) {
            //console.log("DEBUG: Proceed to save (isChildUpdating = true).");
            return true;
        }

        /*
        if ($('#FieldSetGeneral').find('input').prop('readonly')) {
            return true;
        }
        */

        // 4. 並び順の更新処理を開始
        (async () => {
            try {
                console.log("DEBUG: Start to save record update.");
                // 共通関数を使って更新
                await updateChildOrder();

                // 5. 更新完了後、再クリック
                isChildUpdating = true;
                $sender.trigger('click');

            } catch (e) {
                console.error("並び替え更新エラー", e);
                // エラー時はロック解除
                $('#MainContainer').css('opacity', '1');
            }
        })();

        return false;
    };

    setupSortableChildTable();
    //#endregion

};