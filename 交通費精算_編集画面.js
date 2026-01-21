// 交通費申請　編集画面
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
    //自分と上長の「従業員一覧」レコード情報(#region<「従業員一覧」テーブル情報取得(自分＆上長)>内で定義)
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

    //#region <【重要】初期表示時のチラつき防止対策 (CSS注入)>
    // =========================================================================
    // ▼ JavaScriptの判定を待たずに、まずはCSSで子テーブルを「使用不可」に見せる
    //    判定後、OKならこのスタイルを削除し、NGならそのままにする
    // =========================================================================
    const LOCK_STYLE_ID = 'temp-child-lock-style';
    const lockCss = `
        <style id="${LOCK_STYLE_ID}">
            table[data-id="${CHILD_TABLE_ID}"] tbody tr {
                pointer-events: none !important;
                color: #999 !important;
                background-color: #f9f9f9 !important;
            }
            table[data-id="${CHILD_TABLE_ID}"] tbody a {
                pointer-events: none !important;
                cursor: default !important;
                text-decoration: none !important;
                color: #999 !important;
            }
        </style>
    `;
    $('head').append(lockCss);
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
            //自分の情報を取得 (Promiseキャッシュ)
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

            // 待機
            const myData = await myEmployeeDataPromise;
            const supData = await supEmployeeDataPromise;

        } catch (e) {
            console.error("初期データ取得に失敗", e);
        }
    })();
    //#endregion

    //#region<メイン処理：アクセス制御とUI構築>
    // =========================================================================
    // ▼ 権限判定を行い、OKの場合のみボタン作成＆ロック解除を行う
    // =========================================================================
    (async () => {
        // 1. 判定用データの準備
        const myEmpData = await getMyEmployeeData();
        const myEmpRecordId = myEmpData ? String(myEmpData.ResultId) : null; 
        
        const applicantId = $p.getControl(CLASS_USER).val();    // 画面上の「申請者」ID (ClassA)
        const creatorId   = $p.getControl(CLASS_CREATOR).val(); // 画面上の「作成者」User ID (ClassD)
        const currentUserId = String($p.userId());              // ログインユーザーID
        
        const statusText = $p.getControl('Status').text();      // 現在のステータス名

        // 2. 条件判定
        // 条件A: ユーザーが「申請者」または「作成者」である
        const isAuthorizedUser = (myEmpRecordId === applicantId) || (currentUserId === creatorId);
        
        // 条件B: ステータスが「作成中」または「差し戻し」である
        const isEditableStatus = (statusText === STATUS_CREATING || statusText === STATUS_REJECT);

        // 両方の条件を満たしているか？
        const canEditChild = isAuthorizedUser && isEditableStatus;

        console.log(`DEBUG: Child Access Check -> UserOK:${isAuthorizedUser}, StatusOK:${isEditableStatus}, Result:${canEditChild}`);

        // 3. 【分岐処理】
        if (canEditChild) {
            // ===========================================================
            // パターンA：編集可能（許可）の場合
            // ===========================================================
            
            // A-1. 初期ロック（CSS）を解除する
            $('#' + LOCK_STYLE_ID).remove();

            // A-2. 入力支援機能（経路パネル・OCR）を構築・表示する
            initInputSupportUI();

        } else {
            // ===========================================================
            // パターンB：編集不可（不許可）の場合
            // ===========================================================
            // 何もしない（初期ロックCSSが効いたままになるので、リンクは無効化されたまま）
            // ボタン類も作成しないので、削除する必要もない
            console.log('DEBUG: Access denied. Input UI will not be rendered.');
        }
    })();
    //#endregion

    //#region<UI構築関数群 (許可された場合のみ実行)>
    const initInputSupportUI = () => {
        
        // 子レコード作成ボタンを特定
        var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
        if ($targetBtn.length === 0) return;

        // ---------------------------------------------------------
        // 1. 経路選択パネルの作成
        // ---------------------------------------------------------
        // 重複対策: ID重複チェック
        if ($('#CustomRouteContainer').length === 0) {
            
            // データを保持しておくための変数
            let cachedFavRecords = null;

            const panelHtml = `
                <div id="CustomRouteContainer" style="clear: both; margin-top: 20px;">
                    <h4 id="RoutePanelHeader" style="margin-bottom: 5px; font-weight: bold; color: #333; cursor: pointer; user-select: none;">
                        <span id="RoutePanelToggleIcon" class="ui-icon ui-icon-circle-minus" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>経路候補一覧
                    </h4>
                    <div id="EmbeddedRoutePanel" style="border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9; border-radius: 4px;">
                        <div id="RouteTabs" style="font-size: 0.9em; background: transparent; border: none;">
                            <ul>
                                <li><a href="#tab-history">利用経路履歴</a></li>
                                <li><a href="#tab-fav">お気に入り経路</a></li>
                            </ul>
                            <div id="tab-history" style="min-height: 150px; padding: 10px 0;">
                                <p id="hist-loading-msg" style="color:#666; margin:10px;">（タブをクリックして読み込み）</p>
                            </div>
                            <div id="tab-fav" style="min-height: 150px; padding: 10px 0; border-top: none;">
                                <p id="fav-loading-msg" style="color:#666; margin:10px;">（タブをクリックして読み込み）</p>
                            </div>
                        </div>
                    </div>
                    <h4 style="margin-top: 30px; margin-bottom: 10px; font-weight: bold; color: #333; border-bottom: 2px solid #0056b3; padding-bottom: 5px; width: 100%;">
                        <span class="ui-icon ui-icon-note" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>登録中の交通費情報
                    </h4>
                </div>
            `;

            // 挿入実行
            let $anchor = $targetBtn.filter(':visible');
            if ($anchor.length === 0) $anchor = $targetBtn.next(); 
            if ($anchor.length === 0) $anchor = $targetBtn;
            $anchor.last().after(panelHtml);

            // --- 内部関数定義 (loadHistoryData, renderFavPage等) ---
            // ※スコープ内で定義して使用
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
                        console.error(e);
                        $histContainer.html('<p style="color:red; margin:10px;">履歴の読み込みに失敗しました。</p>');
                        return;
                    }
                }

                $histContainer.empty();
                if (historyList.length === 0) {
                    $histContainer.html('<p style="color:#666; margin:10px;">履歴はありません。</p>');
                } else {
                    let tableHtml = '<p style="color:#666; margin:10px;">直近' + HIST_REGISTQTY + '件の登録経路情報が表示されます。</p>';
                    tableHtml += '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;">';
                    tableHtml += '<thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="width:200px; "padding:5px;">日付</th><th style="width:200px; "padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="padding:5px;">備考</th></tr></thead><tbody>';
                    
                    const limit = (typeof PAGE_SIZE !== 'undefined') ? PAGE_SIZE : 5;
                    historyList.slice(0, limit).forEach(r => {
                        const routeDesc = (r.ClassA || '') + ' → ' + (r.ClassB || '') + ' <span style="color:#666;">(' + (r.ClassC || '-') + ')</span>'; 
                        const copyData = {
                            ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumC: r.NumA, 
                            ClassE: $p.getControl('ClassA').val(), ClassC: $p.getControl('ClassB').val(), 
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

                let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="padding:5px;">名称</th><th style="padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="width:30px; padding:5px;"></th></tr></thead><tbody>';
                displayRecords.forEach(r => {
                    const recordId = r.IssueId || r.ResultId || r.Id;
                    const routeDesc = (r.ClassA || '') + ' → ' + (r.ClassB || '') + ' <span style="color:#666;">(' + (r.ClassC || '-') + ')</span>';
                    const copyData = { Title: r.Title, ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumC: r.NumA, Body: r.Body, ClassE: $p.getControl('ClassA').val(), ClassC: $p.getControl('ClassB').val(), ClassI: String($p.id()), _mode: 'copy' };
                    const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                    tableHtml += `<tr style="border-bottom:1px solid #eee;"><td style="text-align:center; padding: 5px;"><button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button></td><td style="padding: 5px;">${r.Title}</td><td style="padding: 5px;">${routeDesc}</td><td style="text-align:right; padding: 5px;">${(r.NumA || 0).toLocaleString()  + "円"}</td><td style="text-align:center; padding: 5px;"><button type="button" class="delete-fav-btn ui-button ui-corner-all ui-widget" style="padding: 1px 6px; font-size: 11px; color: white; background-color: #d9534f; border: 1px solid #d43f3a; border-radius: 3px;" title="削除" data-id="${recordId}" data-page="${page}">×</button></td></tr>`;
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
                    console.error(e);
                    $favContainer.html('<p style="color:red; margin:10px;">データの読み込みに失敗しました。</p>');
                }
            };

            // Tabs初期化
            $('#RouteTabs').tabs({
                activate: function(event, ui) {
                    const panelId = ui.newPanel.attr('id');
                    if (panelId === 'tab-history') loadHistoryData();
                    else if (panelId === 'tab-fav') {
                        if (cachedFavRecords === null) fetchAllFavData();
                        else renderFavPage(1);
                    }
                }
            });
            // 初期ロード
            loadHistoryData();

            // イベントハンドラ登録
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
                const targetId = String($(this).data('id'));
                const currentPage = $(this).data('page');
                try {
                    await apiDeleteAsync(targetId);
                    cachedFavRecords = cachedFavRecords.filter(r => String(r.IssueId || r.ResultId || r.Id) !== targetId);
                    renderFavPage(currentPage);
                } catch (e) {
                    console.error(e);
                    alert("削除に失敗しました。");
                }
            });
            $(document).off('click', '.select-route-btn').on('click', '.select-route-btn', function() {
                const data = $(this).data('json');
                data.ParentId = $p.id();
                sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(data));
                const linkCol = (typeof LINK_COLUMN_NAME !== 'undefined') ? LINK_COLUMN_NAME : 'ClassI';
                window.location.href = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + linkCol + '=' + data.ParentId;
            });
        }

        // ---------------------------------------------------------
        // 2. OCRボタンの作成
        // ---------------------------------------------------------
        // 重複対策: ID重複チェック
        if ($('#BtnOcrRead').length === 0) {
            const ocrBtnHtml = `
                <button id="BtnOcrRead" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px;">
                    <span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-image"></span>画像から交通費情報を読取(OCR)
                </button>
                <input type="file" id="OcrFileInput" accept="image/png, image/jpeg" style="display:none;">
            `;
            
            // 経路ボタンの隣に追加
            let $anchorBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
            if($anchorBtn.length > 0) {
                // 表示されてるボタンの後ろ、なければ隠れてるボタンの後ろ
                let $visibleBtn = $anchorBtn.filter(':visible');
                if($visibleBtn.length > 0) $visibleBtn.last().after(ocrBtnHtml);
                else $anchorBtn.last().after(ocrBtnHtml);
            }

            // OCRイベントハンドラ
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

            // OCR結果モーダル関連
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
                        StartTime: raw.date, ClassA: raw.dep, ClassB: raw.arr, ClassD: raw.way, NumA: raw.amount, Body: raw.memo,
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
    };
    //#endregion

    //#region<作成者自動入力>
    //初回編集画面時(作成者欄ブランク時)に作成ボタンを押したユーザーのIDを入力
    if($p.getControl(CLASS_CREATOR).val() === ''){
        console.log("DEBUG: Input Creator ID: " + $p.userId());
        $p.set($p.getControl(CLASS_CREATOR), $p.userId());
    }
    //#endregion

    //#region<承認日、承認者入力>
    // ... (元のロジックのまま)
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

        //承認者入力
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
    // 子レコード作成ボタン（青いボタン）の制御
    var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
    
    if ($targetBtn.length > 0) {
        $targetBtn.contents().filter(function() { return this.nodeType === 3; }).replaceWith(' 交通費情報を入力するにはこちらをクリック');

        // ★判定：「作成中」以外かどうか
        if (currentStatus !== STATUS_CREATING && currentStatus !== STATUS_REJECT) {
            // パターンA：無効化（グレーアウト）
            var $disabledBtn = $targetBtn.clone(false).removeAttr('onclick');
            $disabledBtn.css({ 'background-color': '#dcdcdc', 'border-color': '#cccccc', 'color': '#888888', 'font-weight': 'bold', 'padding': '5px 15px', 'cursor': 'not-allowed', 'background-image': 'none' });
            $disabledBtn.on('click', function(e) { e.preventDefault(); alert("現在は承認依頼済み、または完了ステータスのため、情報の入力はできません。"); });
            $targetBtn.hide().after($disabledBtn);
        } 
        //作成者以外
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
};