// 交通費申請　編集画面

//#region<使用環境毎の設定定数> ※新環境でこのスクリプトを導入する際は必ずここの定数に値を書き加えること。
//===============================================================================================================================================
//以下@siteid list start以下はサイトパッケージエクスポートにて自動変換されるため手での修正不要
// @siteid list start@
// 以下クラウド版用のID
// const CHILD_TABLE_ID = 15339887;    //「交通費精算レコード」テーブルID
// const FAV_TABLE_ID = 15951290;      //「お気に入り経路」テーブルID
// const HIST_TABLE_ID = 15960204;     //「経路履歴」テーブルID

// const KEIRI_GROUP_ID = 3305;    //「経理担当」グループID
// const GAAPP_GROUP_ID = 3304;    //「総務承認者」グループID

// const URL_PASS = '/fs';        //API用URL　パス部分の記載 http://{サーバー名}/{パス}/api/{コントローラー名}/{ID}/{メソッド名}

//以下オンプレミス版のID
const CHILD_TABLE_ID = 5;    //「交通費精算レコード」テーブルID
const FAV_TABLE_ID = 7;      //「お気に入り経路」テーブルID
const HIST_TABLE_ID = 8;     //「経路履歴」テーブルID

const KEIRI_GROUP_ID = 2;    //「経理担当」グループID
const GAAPP_GROUP_ID = 3;    //「総務承認者」グループID

const URL_PASS = '';        //API用URL　パス部分の記載 http://{サーバー名}/{パス}/api/{コントローラー名}/{ID}/{メソッド名}
// @siteid list end@
//GAS(駅すぱあとAPI及びGemini API使用用の踏み台スクリプト)のAPI URL
const GAS_TRANSREPO_URL = 'https://script.google.com/macros/s/AKfycbwv_UdDOkIvyVcz_oAj-1odo4yEWD013cKTs4u3bxXhB0qPvWwS_qAE-ZyKL4SQDh_Q/exec';
//総務管理部の編集権限(trueの場合、常に総務部は編集権限を持つ。montecampo社内運用特例権限用の変数。特に理由が無ければfalse推奨)
const GeneralAffairs_editable = true;

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★変数ではないが、以下一覧画面用のスクリプトを実装する必要あり。(一覧画面の削除ボタン非表示化) 
// ★「テーブル管理」>「スクリプト」から「新規作成」を選択し、スクリプト部に以下のコマンドを記載。
// ★　$('#BulkDeleteCommand').hide();                                                      
// ★その後、チェックボックスを「一覧」のみ選択し、保存する。                                   
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

//===============================================================================================================================================
//#endregion

$p.events.on_editor_load = function () {

    //#region<標準の離脱警告ポップアップ無効化>
    // =========================================================================
    // ▼ プリザンター標準の「変更が保存されていません」ポップアップを完全に無効化
    // =========================================================================
    const disableDefaultWarning = () => {
        $(window).off('beforeunload'); // jQueryで設定されたイベントを解除
        window.onbeforeunload = null;  // ネイティブJSで設定されたイベントを解除
    };

    // 1. 画面表示時にまずは解除
    disableDefaultWarning();

    // 2. 入力変更時にプリザンターが裏側で再設定してくるのを待ち伏せて、即座に解除
    // ※setTimeoutを使うことで、プリザンターの内部処理が終わった直後に確実に解除できます
    $(document).on('change keyup', 'input, select, textarea', function() {
        setTimeout(disableDefaultWarning, 10);
    });
    //#endregion

    //#region<定数定義>
    
    //ログインユーザID
    const currentUserId = String($p.userId());

    // =========================================================================
    // 【設定エリア】
    // =========================================================================
    const CLASS_USER = 'ClassA';        //「申請者」(User ID)
    const CLASS_SUPERIOR = 'ClassB';    //「上長」(User ID)
    const CLASS_ACCID = 'ClassC';       //「経理担当」(User ID)
    const CLASS_GAID = 'ClassE';        //「総務承認者」(User ID)
    const CLASS_CREATOR = 'ClassD';     //「作成者」(User ID)
    const CLASS_REQUESTDATE = 'DateA';  //「申請日」
    const CLASS_SUPFIXDATE = 'DateB';   //「承認日(上長)」
    const CLASS_ACCFIXDATE = 'DateC';   //「承認日(経理担当)」
    const CLASS_GAFIXDATE = 'DateE';    //「承認日(総務部)」
    const CLASS_FIXDATE = 'DateD';      //「精算日」
    const CLASS_PAYWAY = 'ClassF';      //「精算方法」
    const CLASS_ACCCHECK = 'CheckA';    // 「経理担当チェックボックス表示」項目
    const PARENT_CHECKED_LIST_COL = 'DescriptionA'; // チェックしたIDを保存する親のテキスト項目
    const PAYWAY_INDIV = '個別支払';    //「精算方法」個別支払いの際のテキスト表記

    // const GA_DEPT_NAME = '総務管理部';

    const LINK_COLUMN_NAME = 'ClassI'; 
    const PARENT_USER_COLUMN = 'ClassA'; 

    const ACCFIXBTN_ID = 'Process_3'; //「決済(完了)」ボタンID

    // ステータスID定義
    // 現在のステータス取得
    const currentStatus = $p.getControl('Status').text();
    const STATUS_TEXT = {
       creating: '作成中',
       approval: '承認待ち',
       underrev: '決済待ち',
       finalapp: '総務承認待ち',
       underset: '精算待ち',
       completed: '完了',
       reject: '差し戻し'
    }

    //「交通費精算レコード」テーブル
    const TRAFREC_CLASS_DATANO = 'NumB';//「清算書内データNo」欄
    const TRAFREC_CLASS_ACCCHECK = 'CheckA';   //「経理担当チェック」欄
    const FIELD_MAP = {
        date:        'StartTime',
        destination: 'Title',
        dep:         'ClassA',
        arr:         'ClassB',
        way:         'ClassD',
        trip:        'ClassH',
        amount:      'NumC',
        totalamount: 'NumA',
        memo:        'Body',
        approvedDate: 'DateB'
    };

    // 「お気に入り経路」テーブル
    const FAV_USER_COL = 'ClassD'; 
    const FAV_CLASS_NAME = 'Title';
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
    const HIST_USER_COL = 'ClassD'; 
    const HIST_REGISTDATE = 'DateA';
    const HIST_MEMO = 'Body';
    const HIST_REGISTQTY = 5;

    const PAGE_SIZE = 5; 
    const HIST_FIELD_MAP = {
        destination: 'Title',
        dep:         'ClassA',
        arr:         'ClassB',
        way:         'ClassC',
        amount:      'NumA'
    };

    //sessionStorageキー
    const SESSION_KEY_ACC_EDITABLE = 'TrafficApp_GeneralAffairsEditable'

    //追加実装ボタン
    //--ここに追記--
    //

    // =========================================================================
    // 指定項目読み取り専用化
    const setReadOnlyStyle = (selector) => {
        const $ctrl = $p.getControl(selector);
        // 1. もし親が date-field (時計アイコン付きの箱) なら、箱から出す
        const $dateFieldWrapper = $ctrl.closest('date-field');
        if ($dateFieldWrapper.length > 0) {
            // inputタグ(自分)を箱の直前に移動
            $dateFieldWrapper.before($ctrl);
            // 空になった箱(date-field)を削除 → これで時計アイコンも消える
            $dateFieldWrapper.remove();
        }
        // 2. 入力欄自体のロック
        $ctrl.prop('readonly', true).css({
            'pointer-events': 'none',
            //'background-color': '#F5F5F5', 
            'cursor': 'default'
        });
        // 3. 通常のアイコン（人アイコンなど）を隠す
        $ctrl.siblings('.ui-icon-person').hide();
    };


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
            $('#MainContainer').css('opacity', '0.5'); // 処理中表示
            try {
                await Promise.all(updatePromises);
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
        if ($('#CustomRouteContainer').length === 0) {
            //#region<<<経路履歴>>>
            // const panelHtml = `
            //     <div id="CustomRouteContainer" style="clear: both; margin-top: 20px;">
            //         <h4 id="RoutePanelHeader" style="margin-bottom: 5px; font-weight: bold; color: #333; cursor: pointer; user-select: none;">
            //             <span id="RoutePanelToggleIcon" class="ui-icon ui-icon-circle-minus" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>経路候補一覧
            //         </h4>
            //         <div id="EmbeddedRoutePanel" style="border: 1px solid #ddd; padding: 10px; <!--background-color: #f9f9f9;--> border-radius: 4px;">
            //             <div id="RouteTabs" style="font-size: 0.9em; background: transparent; border: none;">
            //                 <ul><li><a href="#tab-history">利用経路履歴</a></li><li><a href="#tab-fav">お気に入り経路</a></li></ul>
            //                 <div id="tab-history" style="min-height: 150px; padding: 10px 0;"><p id="hist-loading-msg" style="color:#666; margin:10px;">（タブをクリックして読み込み）</p></div>
            //                 <div id="tab-fav" style="min-height: 150px; padding: 10px 0; border-top: none;"><p id="fav-loading-msg" style="color:#666; margin:10px;">（タブをクリックして読み込み）</p></div>
            //             </div>
            //         </div>
            //         <h4 style="margin-top: 30px; margin-bottom: 10px; font-weight: bold; color: #333; border-bottom: 2px solid #00b32da4; padding-bottom: 5px; width: 100%;">
            //             <span class="ui-icon ui-icon-note" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>登録中の交通費情報
            //         </h4>
            //     </div>`;
            const panelHtml = `
                <div id="CustomRouteContainer" style="clear: both; margin-top: 20px;">
                    <h4 id="RoutePanelHeader" style="margin-bottom: 5px; font-weight: bold; cursor: pointer; user-select: none;">
                        <span id="RoutePanelToggleIcon" class="ui-icon ui-icon-circle-minus" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>経路候補一覧
                    </h4>
                    <div id="EmbeddedRoutePanel" style="border: 1px solid rgba(128, 128, 128, 0.3); padding: 10px; border-radius: 4px;">
                        <div id="RouteTabs" style="font-size: 0.9em; background: transparent; border: none;">
                            <ul>
                                <li><a href="#tab-history">利用経路履歴</a></li>
                                <li><a href="#tab-fav">お気に入り経路</a></li>
                            </ul>
                            <div id="tab-history" style="min-height: 150px; padding: 10px 0;">
                                <p id="hist-loading-msg" style="opacity: 0.7; margin: 10px;">（タブをクリックして読み込み）</p>
                            </div>
                            <div id="tab-fav" style="min-height: 150px; padding: 10px 0; border-top: none;">
                                <p id="fav-loading-msg" style="opacity: 0.7; margin: 10px;">（タブをクリックして読み込み）</p>
                            </div>
                        </div>
                    </div>
                    <h4 style="margin-top: 30px; margin-bottom: 10px; font-weight: bold; border-bottom: 2px solid #00b32da4; padding-bottom: 5px; width: 100%;">
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
                    let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th style="width:70px;"></th><th>日付</th><th>行先</th><th>経路</th><th>金額</th><th>備考</th></tr></thead><tbody>';
                    const limit = 5;
                    historyList.slice(0, limit).forEach(r => {
                        const routeDesc = (r['ClassHash'][HIST_FIELD_MAP.dep] || '') + ' → ' + (r['ClassHash'][HIST_FIELD_MAP.arr] || '') + ' <span style="color:#666;">(' + (r['ClassHash'][HIST_FIELD_MAP.way] || '-') + ')</span>'; 
                        const copyData = {
                            [FIELD_MAP.destination]: r[HIST_FIELD_MAP.destination], 
                            [FIELD_MAP.dep]: r['ClassHash'][HIST_FIELD_MAP.dep], 
                            [FIELD_MAP.arr]: r['ClassHash'][HIST_FIELD_MAP.arr], 
                            [FIELD_MAP.way]: r['ClassHash'][HIST_FIELD_MAP.way], 
                            [FIELD_MAP.amount]: r['NumHash'][HIST_FIELD_MAP.amount], 
                            _mode: 'copy'
                        };
                        const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                        let dateStr = r['DateHash'][HIST_REGISTDATE] ? new Date(r['DateHash'][HIST_REGISTDATE]).toLocaleDateString() : '-';
                        tableHtml += 
                        `<tr style="border-bottom:1px solid #eee;">
                            <td style="text-align:center; padding: 5px;">
                                <button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" style="padding:2px 8px; font-size:11px; white-space: nowrap;" 
                                data-json="${jsonStr}">選択</button>
                            </td>
                            <td style="padding: 5px;">${dateStr}</td>
                            <td style="padding: 5px;">${r[HIST_FIELD_MAP.destination]}</td>
                            <td style="padding: 5px;">${routeDesc}</td>
                            <td style="text-align:right; padding: 5px;">${(r['NumHash'][HIST_FIELD_MAP.amount] || 0).toLocaleString() + "円"}</td>
                            <td style="padding: 5px;">${r[HIST_MEMO] || ''}</td>
                        </tr>`;
                    });
                    tableHtml += '</tbody></table>';
                    $histContainer.html(tableHtml);
                }
            };
            //#endregion

            //#region<<<お気に入り経路>>>
            let cachedFavRecords = null;
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
                console.log(`DEBUG: お気に入り経路表示 - Page ${page}/${totalPages}`, displayRecords);

                let tableHtml = 
                '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;"><thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="padding:5px;">名称</th><th style="padding:5px;">行先</th><th style="padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="width:30px; padding:5px;"></th></tr></thead><tbody>';

                displayRecords.forEach(r => {
                    const recordId = r.IssueId || r.ResultId || r.Id;
                    const routeDesc = (r['ClassHash'][FAV_FIELD_MAP.dep] || '') + ' → ' + (r['ClassHash'][FAV_FIELD_MAP.arr] || '') + ' <span style="color:#666;">(' + (r['ClassHash'][FAV_FIELD_MAP.way] || '-') + ')</span>';
                    //子レコードへのコピー用データ作成(お気に入り経路欄→子レコード欄への変換)
                    const copyData = { 
                        [FIELD_MAP.destination] : r['ClassHash'][FAV_FIELD_MAP.destination], 
                        [FIELD_MAP.dep]: r['ClassHash'][FAV_FIELD_MAP.dep], 
                        [FIELD_MAP.arr]: r['ClassHash'][FAV_FIELD_MAP.arr], 
                        [FIELD_MAP.way]: r['ClassHash'][FAV_FIELD_MAP.way], 
                        [FIELD_MAP.amount]: r['NumHash'][FAV_FIELD_MAP.amount], 
                        [FIELD_MAP.memo]: r['ClassHash'][FAV_FIELD_MAP.memo], 
                        _mode: 'copy' 
                    };
                    const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                    tableHtml += 
                    `<tr style="border-bottom:1px solid #eee;">
                        <td style="text-align:center; padding: 5px;">
                            <button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" 
                            style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button>
                        </td>
                        <td style="padding: 5px;">${r[FAV_CLASS_NAME]}</td>
                        <td style="padding: 5px;">${r['ClassHash'][FAV_FIELD_MAP.destination]}</td>
                        <td style="padding: 5px;">${routeDesc}</td>
                        <td style="text-align:right; padding: 5px;">${(r['NumHash'][FAV_FIELD_MAP.amount] || 0).toLocaleString()  + "円"}</td>
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
                        data: { 
                            View: { 
                                ColumnFilterHash: { [FAV_USER_COL]: JSON.stringify([String($p.userId())]) }, 
                                ColumnSorterHash: { UpdatedTime: 'desc' } 
                            }, 
                            PageSize: 1000 
                        }
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
                    // console.log("DEBUG: お気に入り経路データ有無確認", "null" ? cachedFavRecords : cachedFavRecords);
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
                window.location.href = URL_PASS + '/Items/' + CHILD_TABLE_ID + '/New?' + LINK_COLUMN_NAME + '=' + data.ParentId;
            });
            //#endregion
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
                window.location.href = URL_PASS + '/Items/' + CHILD_TABLE_ID + '/New?' + (typeof LINK_COLUMN_NAME !== 'undefined' ? LINK_COLUMN_NAME : 'ClassI') + '=' + parentId;
            };
        }
        //#endregion
    
        //#region<<子レコード自動ソートボタン>>
        if ($('#BtnRouteSort').length === 0) {
            const sortBtnHtml = `<button id="BtnRouteSort" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px;"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-arrowthick-2-n-s"></span>日付順に並び替え</button>`;

            const $gridContainer = $('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
            if ($gridContainer.length > 0) {
                $gridContainer.after(sortBtnHtml);
            }

            $(document).on('click', '#BtnRouteSort', function(e) {
                e.preventDefault();
                
                const gridWrap = document.querySelector('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
                
                if (!gridWrap) {
                    alert('対象の明細テーブルが見つかりません。');
                    return;
                }

                const tbody = gridWrap.querySelector('tbody');
                if (!tbody) return;
                const rows = Array.from(tbody.querySelectorAll('tr'));
                if (rows.length <= 1) return;

                const headers = Array.from(gridWrap.querySelectorAll('th'));
                const idxDate = headers.findIndex(th => th.getAttribute('data-name') === FIELD_MAP.date); 
                const idxDep  = headers.findIndex(th => th.getAttribute('data-name') === FIELD_MAP.dep); 
                const idxArr  = headers.findIndex(th => th.getAttribute('data-name') === FIELD_MAP.arr); 

                if (idxDate === -1 || idxDep === -1 || idxArr === -1) {
                    alert('並び替えに失敗しました。');
                    console.log('並び替えに必要な項目（日付, 出発, 到着）が一覧に表示されていません。');
                    return;
                }

                const rowData = rows.map(tr => {
                    return {
                        element: tr,
                        date: tr.children[idxDate].textContent.trim(),
                        dep: tr.children[idxDep].textContent.trim(),
                        arr: tr.children[idxArr].textContent.trim()
                    };
                });

                rowData.sort((a, b) => {
                    const cleanDateA = a.date.substring(0, 10);
                    const cleanDateB = b.date.substring(0, 10);
                    // ① まずは日付で比較
                    const dateA = new Date(cleanDateA).getTime() || 0;
                    const dateB = new Date(cleanDateB).getTime() || 0;
                    if (dateA !== dateB) return dateA - dateB; // 昇順（古い順）

                    // ② 日付が同じ場合：到着駅と出発駅の「しりとり」を確認
                    // Aの到着駅 ＝ Bの出発駅 なら、Aを先にする (-1)
                    if (a.arr !== "" && a.arr === b.dep) return -1;
                    // Bの到着駅 ＝ Aの出発駅 なら、Bを先にする (1)
                    if (b.arr !== "" && b.arr === a.dep) return 1;

                    return 0; 
                });

                // 並び替えた順序でDOMを再構築
                rowData.forEach(item => tbody.appendChild(item.element));
                
                // 変更をプリザンターに検知させる
                gridWrap.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        //#endregion
    };
    //#endregion

    //#region<メイン処理：アクセス制御とUI構築>
    //ユーザーの所属グループ取得
    const checkUserGroupAsync = async (groupId, sessionkey) => {
        const cachedSession = sessionStorage.getItem(sessionkey);
        if(cachedSession !== null){
            return (cachedSession === 'true');
        }
        else{
            return new Promise((resolve) => {
                $p.apiGroupsGet({
                    data:{
                        View: {
                            ColumnFilterHash: {
                                GroupId: '[' + groupId + ']'
                            }
                        }
                    },
                    done: function(res) {
                        try{
                            if (res.StatusCode === 200 && res.Response.Data.length > 0) {
                                const members = res.Response.Data[0].GroupMembers || [];
                                const consist_in_group = members.filter(member => member.split(',').includes(String($p.userId())));
                                const returnbool = consist_in_group.length > 0;
                                sessionStorage.setItem(sessionkey, returnbool);
                                resolve(returnbool);
                            } else {
                                resolve(false);
                            }
                        }
                        catch (e) {
                            console.error("グループ情報の取得に失敗", e);
                            resolve(false);
                        }  
                    },
                    fail: function(err) {
                        console.error("User API Error:", err);
                        resolve(false);
                    }
                });
            });
        }
        
    };

    (async () => {
        //#region<<権限確認>>
        // ---------------------------------------------------------------
        // 1. 情報取得（キャッシュ対応版）
        // ---------------------------------------------------------------
        //グループチェック
        //const groupCheck = async(groupId)

        // 経理担当グループ判定
        const SESSION_KEY_IS_KEIRI = 'TrafficApp_IsKeiri_' + currentUserId;
        let isKeiriMember = await checkUserGroupAsync(KEIRI_GROUP_ID, SESSION_KEY_IS_KEIRI);
        //総務承認者グループ判定
        const SESSION_KEY_IS_GAAPP = 'TrafficApp_IsGAApp_' + currentUserId;
        let isGAAppMember = await checkUserGroupAsync(GAAPP_GROUP_ID, SESSION_KEY_IS_GAAPP);
        // 部署取得アルゴリズム削除
        /*
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
        */

        // ---------------------------------------------------------------
        // 2. 権限判定
        // ---------------------------------------------------------------

        const applicantId = String($p.getControl(CLASS_USER).val() || ''); 
        const creatorId   = String($p.getControl(CLASS_CREATOR).val() || '');
        const superiorId  = String($p.getControl(CLASS_SUPERIOR).val() || '');
        
        const isApplicant = (currentUserId === applicantId) || (currentUserId === creatorId);
        const isSuperior = (superiorId !== '' && currentUserId === superiorId);
        // const isGeneralAffairs = (myDept === GA_DEPT_NAME);
        
        //ステータスチェック
        const st = $p.getControl('Status').text(); 
        const isStatusEdit = (st === STATUS_TEXT.creating || st === STATUS_TEXT.reject);
        const isStatusApproval = (st === STATUS_TEXT.approval);
        const isStatusPayment = (st === STATUS_TEXT.underrev);
        const isStatusFinalApproval = (st === STATUS_TEXT.finalapp);
        const isStatusSettling = (st === STATUS_TEXT.underset);
        const isStatusCompleted = (st === STATUS_TEXT.completed); 

        // console.log(`=== Access Control (User ID Mode) ===`);
        // console.log(`Me: ${currentUserId}`);
        // console.log(`Target -> App: "${applicantId}", Sup: "${superiorId}"`);
        // console.log(`Check -> isApp: ${isApplicant}, isSup: ${isSuperior}, isGA: ${isKeiriMember}`);
        // console.log(`=====================================`);

        // 3. 権限付与ロジック
        let allowEditFields = false; 
        let showProcessButtons = false; 

        //申請者作成関連
        if (isStatusEdit && isApplicant) {
            allowEditFields = true;
            showProcessButtons = true;
        }
        //上長承認関連
        else if (isStatusApproval && isSuperior) {
            allowEditFields = false;
            showProcessButtons = true; 
        }
        //経理担当処理関連
        else if ((isStatusPayment || isStatusSettling || isStatusCompleted) && isKeiriMember) {
            allowEditFields = false;
            showProcessButtons = true; 
        }
        //総務承認者担当関連
        else if(isStatusFinalApproval && isGAAppMember){
            allowEditFields = false;
            showProcessButtons = true; 
        }
        
        //総務管理部編集権限 - 特例を許可する場合
        if (GeneralAffairs_editable && isKeiriMember){
            allowEditFields = true;
            showProcessButtons = true;
        }

        console.log('allowEditField: ' + allowEditFields + ', showProcessButtons: ' + showProcessButtons);

        //総務部編集可能であればsessionStorageにログインユーザーIDを保存
        if(GeneralAffairs_editable && isKeiriMember){
            sessionStorage.setItem(SESSION_KEY_ACC_EDITABLE, currentUserId);
        }
        else{
            sessionStorage.removeItem(SESSION_KEY_ACC_EDITABLE);
        }
        //#endregion

        //#region<<権限毎の画面制御>>
        //#region<<読み取り専用化処理>>
        //デフォルトで読み取り専用の項目を読み取り専用化    
        setReadOnlyStyle(CLASS_SUPFIXDATE);
        setReadOnlyStyle(CLASS_ACCFIXDATE);
        setReadOnlyStyle(CLASS_GAFIXDATE);
        setReadOnlyStyle(CLASS_ACCID);
        setReadOnlyStyle(CLASS_GAID);
        //差し戻し時は申請日も読み取り専用化
        if(currentStatus !== STATUS_TEXT.creating)setReadOnlyStyle(CLASS_REQUESTDATE);
    
        // 4. 画面制御実行
        if (allowEditFields) {
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
           // ★追加: 画面内のすべての date-field (時計アイコンの箱) を破壊して中身だけにする
            $fields.find('date-field').each(function() {
                const $wrapper = $(this);
                const $input = $wrapper.find('input');
                // inputが見つかれば、箱の外に出して箱を消す
                if ($input.length > 0) {
                    $wrapper.before($input);
                    $wrapper.remove();
                }
            });

            $fields.find('input, select, textarea').prop('readonly', true);
            $fields.find('input, select, textarea, label').css({
                'pointer-events': 'none',
                'background-color': '#F5F5F5', 
                'color': 'inherit',         
                'cursor': 'default'         
            });
            $fields.find('.ui-icon-person').hide();
            
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

        if (!showProcessButtons) {
            $('#MainCommands button').hide();
            $('#GoBack').show();
        }
        //#endregion

        //#region<<経理チェック欄表示制御>>
        let retryCount = 0; // リトライ回数をカウント
        const MAX_RETRIES = 100; // 最大リトライ回数（例: 20回 -> 約2秒間）
        const setupAccountingCheckboxes = () => {
            // 1. グリッドのラッパー要素を探す
            const gridWrap = document.querySelector('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');

            if (!gridWrap) {
                if (++retryCount < MAX_RETRIES) setTimeout(setupAccountingCheckboxes, 100);
                return;
            }

            // 2. ラッパーの直下（Light DOM）からテーブルヘッダーと行を探す！
            const th = gridWrap.querySelector(`th[data-name="${TRAFREC_CLASS_ACCCHECK}"]`);
            const rows = gridWrap.querySelectorAll('tbody tr');

            if (!th || rows.length === 0) {
                if (++retryCount < MAX_RETRIES) setTimeout(setupAccountingCheckboxes, 100);
                return;
            }

            
            // 3. 表示/非表示とチェックボックスの描画
            const isAccountingMode = $p.getValue(CLASS_ACCCHECK);
            
            // th が何列目にあるか取得
            const headers = Array.from(gridWrap.querySelectorAll('th'));
            const colIndex = headers.indexOf(th);

            if (!isAccountingMode) {
                // --- パターンA：非表示 ---
                th.style.display = 'none';
                rows.forEach(tr => {
                    if (tr.children[colIndex]) tr.children[colIndex].style.display = 'none';
                });

            } else {
                // --- パターンB：チェックボックス描画 ---
                let currentCheckedList = $p.getControl(PARENT_CHECKED_LIST_COL).val() || ",";
                if (currentCheckedList === "") currentCheckedList = ",";

                rows.forEach(tr => {
                    const recordId = tr.getAttribute('data-id');
                    const targetCell = tr.children[colIndex];

                    if (recordId && targetCell) {
                        // すでにチェックボックス作成済みの場合はスキップ
                        if(targetCell.querySelector('.accounting-checkbox')) return; 

                        const isChecked = currentCheckedList.includes(',' + recordId + ',');

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'accounting-checkbox';
                        checkbox.setAttribute('data-record-id', recordId);
                        checkbox.checked = isChecked;
                        
                        //経理担当以外、または決済待ちステータス時は操作不可にする
                        //console.log(`DEBUG: check user ID: '+ ${$p.userId()} + ', isKeiriMember: ${isKeiriMember}, currentStatus: ${currentStatus}`);
                        if ((!isKeiriMember || currentStatus !== STATUS_TEXT.underrev) && $p.userId() !== 1) {
                            //checkbox.disabled = true; // クリック操作を無効化
                            // 代わりに、クリックされても状態変化を強制キャンセルする
                            checkbox.addEventListener('click', (e) => {
                                e.preventDefault(); 
                            });
                            //checkbox.style.cursor = 'not-allowed'; // カーソルを「禁止マーク」にする
                            //checkbox.style.setProperty('cursor', 'not-allowed', 'important');
                        }

                        checkbox.style.transform = 'scale(1.5)';
                        checkbox.style.cursor = 'pointer';
                        checkbox.style.margin = '5px';

                        targetCell.innerHTML = '';
                        targetCell.appendChild(checkbox);
                        targetCell.style.textAlign = 'center';

                        // このセル（td）がクリックされても、行の遷移イベントをブロックする
                        targetCell.addEventListener('click', (e) => {
                            e.stopPropagation(); // 遷移の波及をここで止める！
                        });
                    }
                });

                // 4. クリックイベントの登録（重複登録防止付き）
                if (!gridWrap.dataset.hasEvent) {
                    gridWrap.addEventListener('change', (e) => {
                        if (e.target.classList.contains('accounting-checkbox')) {
                            const recId = e.target.getAttribute('data-record-id');
                            let list = $p.getControl(PARENT_CHECKED_LIST_COL).val() || ",";
                            if (list === "") list = ",";

                            if (e.target.checked) {
                                if (!list.includes(',' + recId + ',')) list += recId + ',';
                            } else {
                                list = list.replace(',' + recId + ',', ',');
                            }
                            if (list === ",") list = "";
                            
                            $p.set($p.getControl(PARENT_CHECKED_LIST_COL), list);
                            //console.log("DEBUG: 保存用メモ更新 -> ", list);
                        }
                    });
                    gridWrap.dataset.hasEvent = "true";
                }

                // 経理チェック一括ON/OFFボタン
                if (isKeiriMember && currentStatus === STATUS_TEXT.underrev && $('#BtnCheckAllAccounting').length === 0) {
                    const checkAllBtnHtml = `<button id="BtnCheckAllAccounting" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px; margin-bottom: 5px;"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-check"></span>経理一括ON/OFF</button>`;
                    
                    const $gridContainer = $('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
                    if ($gridContainer.length > 0) {
                        $gridContainer.after(checkAllBtnHtml);
                    }

                    // 一括クリック時の処理
                    $(document).off('click', '#BtnCheckAllAccounting').on('click', '#BtnCheckAllAccounting', function(e) {
                        e.preventDefault();
                        
                        const checkboxes = gridWrap.querySelectorAll('.accounting-checkbox');
                        if (checkboxes.length === 0) return;

                        // 現在、すべてチェックされているかを判定
                        let isAllChecked = true;
                        checkboxes.forEach(cb => { if (!cb.checked) isAllChecked = false; });

                        // 保存用テキストを呼び出し
                        let list = $p.getControl(PARENT_CHECKED_LIST_COL).val() || ",";
                        if (list === "") list = ",";

                        // チェックボックスの状態と保存用テキストを一括更新
                        checkboxes.forEach(cb => {
                            const recId = cb.getAttribute('data-record-id');
                            if (isAllChecked) {
                                // 全部ONなら、すべてOFFにする
                                cb.checked = false;
                                list = list.replace(',' + recId + ',', ',');
                            } else {
                                // 1つでもOFFがあれば、すべてONにする
                                cb.checked = true;
                                if (!list.includes(',' + recId + ',')) list += recId + ',';
                            }
                        });

                        // カンマだけになっていたら空にする
                        if (list === ",") list = "";
                        
                        // 親レコードの非表示項目に保存
                        $p.set($p.getControl(PARENT_CHECKED_LIST_COL), list);
                        //console.log("DEBUG: 一括操作による保存用テキスト更新 -> ", list);
                    });
                }
            }
        };

        setupAccountingCheckboxes();
        //#endregion

        //#region<<子テーブル：標準の列タイトルクリック（ソート）を無効化する透明カーテン>>
        let disableSortRetryCount = 0;
        const MAX_DISABLE_SORT_RETRIES = 100;

        const disableDefaultSort = () => {
            const gridWrap = document.querySelector('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
            
            if (!gridWrap) {
                if (++disableSortRetryCount < MAX_DISABLE_SORT_RETRIES) setTimeout(disableDefaultSort, 100);
                return;
            }

            // タイトル行（ヘッダー）を取得
            const headerRow = gridWrap.querySelector('thead tr.ui-widget-header');
            
            if (headerRow) {
                // 1. 透明カーテン（マウスイベントの完全無効化）を付与
                headerRow.style.pointerEvents = 'none';
            } else {
                // テーブルの外枠はあるが中身がまだ描画されていない場合のリトライ
                if (++disableSortRetryCount < MAX_DISABLE_SORT_RETRIES) setTimeout(disableDefaultSort, 100);
            }
        };

        disableDefaultSort();
        //#endregion

        //#endregion

        //#region<<PDFボタン>>
        // 新規作成以外且つ総務部の場合にPDFボタンを追加する
        if($p.action() !== 'new' && isKeiriMember && currentStatus !== STATUS_TEXT.creating){
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
                        //PDF出力前に、現在の並び順を保存する処理
                        const updateSuccess = await updateChildOrder();
                        
                        // 保存に失敗した場合（キャンセル含む）は、PDF出力を中断する
                        if (!updateSuccess) return;

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
                        console.log("DEBUG: 取得した明細データ -> ", records);

                        // 💡 ヘルパー関数: ユーザー項目の「表示名（名前）」を確実に取得する
                        const getUserName = (classId) => {
                            const $ctrl = $p.getControl(classId);
                            // ドロップダウン（select）の場合、選択中のoptionのテキストを取得
                            let name = $ctrl.find('option:selected').text().trim();
                            // 読み取り専用などでselectでない場合は、要素のテキストを直接取得
                            if (!name) name = $ctrl.text().trim();
                            // それでも取れなければ value を試す（一応のフォールバック）
                            if (!name) name = $ctrl.val();
                            return name || "";
                        };

                        var sendDataList = [];
                        records.forEach(function(row) {
                            sendDataList.push({
                                "id": row.IssueId, "date": formatDate(row[FIELD_MAP.date]), "requestdate": $p.getControl(CLASS_REQUESTDATE).text(),
                                "user": userName, "destination": row[FIELD_MAP.destination], "dep": row['ClassHash'][FIELD_MAP.dep], "arr": row['ClassHash'][FIELD_MAP.arr],
                                "way": row['ClassHash'][FIELD_MAP.way], "trip": row['ClassHash'][FIELD_MAP.trip], "amount": row['NumHash'][FIELD_MAP.totalamount], "memo": row[FIELD_MAP.memo]
                            });
                        });
                        console.log("DEBUG: 送信データの内容 -> ", sendDataList);
                        //承認情報も入力
                        var sendApprovalList = {};
                        
                        //申請者(申請日入力済みか)
                        if(/*$p.getControl(CLASS_REQUESTDATE).text() !== ''*/currentStatus !== STATUS_TEXT.creating && currentStatus !== STATUS_TEXT.reject){ //申請日項目だけプリザンター側で読み取り専用処理をしているためtextで取得
                            sendApprovalList.user = {
                                "name": getUserName(CLASS_USER), // ★修正
                                //"date": $p.getControl(CLASS_REQUESTDATE).val()
                                "date": $p.getControl(CLASS_REQUESTDATE).text()
                            };
                        }
                        //上長(上長承認日入力済みか)
                        if(/*$p.getControl(CLASS_SUPFIXDATE).val() !== ''*/currentStatus !== STATUS_TEXT.creating && currentStatus !== STATUS_TEXT.reject && currentStatus !== STATUS_TEXT.approval){
                            sendApprovalList.superior = {
                                "name": getUserName(CLASS_SUPERIOR), // ★修正
                                "date": $p.getControl(CLASS_SUPFIXDATE).val()
                            };
                        }
                        //経理担当(経理決算日入力済みか)
                        if(/*$p.getControl(CLASS_ACCFIXDATE).val() !== ''*/currentStatus !== STATUS_TEXT.creating 
                        && currentStatus !== STATUS_TEXT.reject && currentStatus !== STATUS_TEXT.approval && currentStatus !== STATUS_TEXT.underrev){
                            sendApprovalList.accounting = {
                                "name": getUserName(CLASS_ACCID), // ★修正
                                "date": $p.getControl(CLASS_ACCFIXDATE).val()
                            };
                        }
                        //総務承認者(総務承認日入力済みか)
                        if(/*$p.getControl(CLASS_GAFIXDATE).val() !== ''*/currentStatus === STATUS_TEXT.underset || currentStatus === STATUS_TEXT.completed){ //総務承認日項目だけプリザンター側で読み取り専用処理をしているためtextで取得
                            sendApprovalList.generalaffair = {
                                "name": getUserName(CLASS_GAID), // ★修正
                                "date": $p.getControl(CLASS_GAFIXDATE).val()
                            };
                        }
                        //精算完了(精算日入力済みか) ※給与組み込みの際は入力不要
                        if($p.getControl(CLASS_FIXDATE).text() !== '' && $p.getControl(CLASS_PAYWAY).text() === PAYWAY_INDIV){ //プリザンター側で読み取り専用処理をしているためtextで取得
                            sendApprovalList.settlement = {
                                "name": getUserName(CLASS_ACCID),
                                "date": $p.getControl(CLASS_FIXDATE).text()
                            };
                        }

                        const payload = {
                            "records": sendDataList,
                            "approval": sendApprovalList
                        };

                        $.ajax({
                            type: 'POST', url: GAS_TRANSREPO_URL, contentType: 'text/plain', data: JSON.stringify(payload),
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

    //#region<自動入力系>
    //作成者(初期起動時に以下実行)
    if($p.getControl(CLASS_CREATOR).val() === ''){
        $p.set($p.getControl(CLASS_CREATOR), $p.userId());
    }
    //承認日(上長)
    if(currentStatus === STATUS_TEXT.approval/*currentStatus === STATUS_TEXT.underrev && $p.getControl(CLASS_SUPFIXDATE).val() === ''*/){
        const today = new Date();
        $p.set($p.getControl(CLASS_SUPFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
    }
    else if(currentStatus == STATUS_TEXT.reject && $p.getControl(CLASS_SUPFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_SUPFIXDATE), '');
    }
    //承認日(経理担当)
    if(currentStatus === STATUS_TEXT.underrev/*currentStatus === STATUS_TEXT.finalapp && $p.getControl(CLASS_ACCFIXDATE).val() === ''*/){
        const today = new Date();
        $p.set($p.getControl(CLASS_ACCFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
        $p.set($p.getControl(CLASS_ACCID), $p.userId());
    }
    else if(currentStatus == STATUS_TEXT.reject && $p.getControl(CLASS_ACCFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_ACCFIXDATE), '');
    }
    //承認日(総務承認)
    if(currentStatus === STATUS_TEXT.finalapp/*currentStatus === STATUS_TEXT.underset && $p.getControl(CLASS_GAFIXDATE).val() === ''*/){
        const today = new Date();
        $p.set($p.getControl(CLASS_GAFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
        $p.set($p.getControl(CLASS_GAID), $p.userId());
    }
    else if(currentStatus == STATUS_TEXT.reject && $p.getControl(CLASS_GAFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_GAFIXDATE), '');
    }
    //#endregion

    //#region <子レコード並び替え & 一括更新機能>
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


        // --- 判定ロジック ---

        if ($sender && ($sender.attr('id') === 'DeleteCommand' || $sender.attr('name') === 'Delete')) {
            return true;
        }
        if (isChildUpdating) {
            return true;
        }

        // 4. 並び順の更新処理を開始
        (async () => {
            try {
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

//#region <決済プロセス実行前のチェック用関数（スクリプトタブに記載）>
$p.ex.validateKeiriCheck = function() {
    console.log("DEBUG: validateKeiriCheck called");
    const gridWrap = document.querySelector('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
    
    if (!gridWrap) return true; // テーブルが無ければ通過させる

    const allCheckboxes = gridWrap.querySelectorAll('.accounting-checkbox');
    const checkedBoxes = gridWrap.querySelectorAll('.accounting-checkbox:checked');

    // 明細が1件以上あり、かつチェック数が一致していない場合
    if (allCheckboxes.length > 0 && allCheckboxes.length !== checkedBoxes.length) {
        alert('【エラー】\n経理チェックが完了していない明細があるため、決済(完了)に進めません。');
        return false; // NGを返す
    }
    
    return true; // OKを返す
};
// #endregion