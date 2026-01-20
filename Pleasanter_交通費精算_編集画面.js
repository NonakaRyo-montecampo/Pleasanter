// 交通費申請　編集画面
$p.events.on_editor_load = function () {

    //#region<定数定義>
    // =========================================================================
    // 【設定エリア】
    // =========================================================================
    const CLASS_REQUESTDATE = 'DateA';  //「申請日」欄
    const CLASS_MANFIXDATE = 'DateB';  //「承認日(上長)」欄
    const CLASS_GAFIXDATE = 'DateC';  //「承認日(総務部)」欄
    const CLASS_GAID = 'ClassC'; //「承認者」欄
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

    // 「お気に入り経路」テーブル
    const FAV_TABLE_ID = 15951290;  // ★お気に入りテーブルID
    // お気に入りマスタのユーザーID項目
    const FAV_USER_COL = 'ClassD'; 

    //「経路履歴」テーブル
    const HIST_TABLE_ID = 15960204;
    const HIST_USER_COL = 'ClassD'; // お気に入りマスタのユーザーID項目

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
    
    // YYYY/MM/DD形式の日付文字列を返す関数
    function getTodayString() {
        var dt = new Date();
        return dt.getFullYear() + '/' + (dt.getMonth() + 1) + '/' + dt.getDate();
    }
    //#endregion

    //#region<作成者自動入力>
    //初回編集画面時(作成者欄ブランク時)に作成ボタンを押したユーザーのIDを入力
    if($p.getControl(CLASS_CREATOR).val() === ''){
        console.log("DEBUG: Input Creator ID: " + $p.userId());
        $p.set($p.getControl(CLASS_CREATOR), $p.userId());
    }
    //#endregion

    //#region<承認日、承認者入力>
    //ステータスが「承認済み」且つ承認日(上長)欄がブランクであれば当日日付入力
    console.log("DEBUG: Current Status: " + currentStatus);
    console.log("DEBUG: Manager Fix date is " + $p.getControl(CLASS_MANFIXDATE).val());
    if(currentStatus === STATUS_UNDERREV && $p.getControl(CLASS_MANFIXDATE).val() === ''){
        const today = new Date();
        console.log("DEBUG: Today:" + today);

        //YYYY/MM/DDの形式にして「承認日」に代入
        const todayyear = today.getFullYear();
        const todaymonth = today.getMonth() + 1;
        const todaydate = today.getDate();
        console.log("DEBUG: Input data: " + todayyear + '/' + todaymonth + '/' + todaydate);
        $p.set($p.getControl(CLASS_MANFIXDATE), todayyear + '/' + todaymonth + '/' + todaydate);
    }
    //ステータスが(「承認済み」または「完了」)を満たさない場合、日付を削除する。
    else if(currentStatus !== STATUS_UNDERREV && currentStatus !== STATUS_COMPLETED && $p.getControl(CLASS_MANFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_MANFIXDATE), '');
    }

    //ステータスが「完了」且つ承認日(総務部)欄がブランクであれば当日日付入力
    console.log("DEBUG: GA Fix date is " + $p.getControl(CLASS_GAFIXDATE).val());
    if(currentStatus === STATUS_COMPLETED && $p.getControl(CLASS_GAFIXDATE).val() === ''){
        //承認日入力
        const today = new Date();
        console.log("DEBUG: Today:" + today);
        //YYYY/MM/DDの形式にして「承認日」に代入
        const todayyear = today.getFullYear();
        const todaymonth = today.getMonth() + 1;
        const todaydate = today.getDate();
        console.log("DEBUG: Input data: " + todayyear + '/' + todaymonth + '/' + todaydate);
        $p.set($p.getControl(CLASS_GAFIXDATE), todayyear + '/' + todaymonth + '/' + todaydate);

        //承認者入力
        // 1. ユーザーＩＤ取得
        let userId = $p.userId();
        console.log('DEBUG: User ID =:' + userId);
        // 2. 「従業員一覧」レコード検索取得
        $p.apiGet({
            id: WORKERTABLE_ID,
            data: {
                View: {
                    "ColumnFilterHash": {
                        // ここもブラケット記法を使っているため、正しい記述です
                        [WORKERTABLE_CLASS_USER]: "[\"" + userId + "\"]"
                    }
                }
            },
            done: function (data) {
                // データが見つかった場合のみ処理する（エラー防止）
                if (data.Response.Data && data.Response.Data.length > 0) {
                    // 3.レコードID抽出
                    let userIdOnWorkerTable = data.Response.Data[0].ResultId;
                    console.log('DEBUG: userIdOnWorkerTable = ' + userIdOnWorkerTable);
                    // 4.「承認者」項目にレコードID代入
                    $p.set($p.getControl(CLASS_GAID), userIdOnWorkerTable);
                } 
                else {
                    console.log('DEBUG: 従業員マスタに該当するユーザーが見つかりませんでした。');
                }
            },
            fail: function(data){
                alert('通信が失敗しました');
            }
        });
    }
    //ステータスが「完了」でない場合、日付を削除する。
    else if(currentStatus !== STATUS_COMPLETED && $p.getControl(CLASS_GAFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_GAFIXDATE), '');
    }
    //#endregion

    //#region<上長以外、承認待ち時に承認ボタン非活性>


    //#endregion

    //#region<交通費精算レコード操作>
    
    
    //#endregion

    //#region<画面制御：読み取り専用化>

    //<既存ボタンのリネーム・装飾・制御>
    //子レコード作成ボタン
    // 子レコード作成ボタン（青いボタン）を特定
    var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
    
    if ($targetBtn.length > 0) {
        // 文言の変更など（既存の処理）
        $targetBtn.contents().filter(function() { return this.nodeType === 3; }).replaceWith(' 交通費情報を入力するにはこちらをクリック');

        // 現在のステータスを取得
        //<定数定義>内で定義
        console.log("DEBUG: Creator = " + $p.getControl(CLASS_CREATOR).val() + ", $p.userId() = " + $p.userId());
        // ★判定：「作成中(100)」以外かどうか
        if (currentStatus !== STATUS_CREATING && currentStatus !== STATUS_REJECT) {
            // =========================================================
            // パターンA：無効化（グレーアウト）＆クリック時アラート
            // =========================================================
            
            // プリザンター標準のクリックイベント（ダイアログ表示）を消すためにクローンを作成
            var $disabledBtn = $targetBtn.clone(false).removeAttr('onclick');
            
            // グレーアウトのスタイル適用
            $disabledBtn.css({
                'background-color': '#dcdcdc', // グレー
                'border-color': '#cccccc',
                'color': '#888888',
                'font-weight': 'bold',
                'padding': '5px 15px',
                'cursor': 'not-allowed', // 禁止マークのカーソル
                'background-image': 'none'
            });

            // クリック時にアラートを表示（念のため）
            $disabledBtn.on('click', function(e) {
                e.preventDefault();
                alert("現在は承認依頼済み、または完了ステータスのため、情報の入力はできません。");
            });

            // 元のボタンを隠して、無効化ボタンを表示
            $targetBtn.hide().after($disabledBtn);

        } 
        //作成者(項目名: 管理者)以外は子レコードの作成ができないように、ボタンを非アクティブにする。
        else if ($p.getControl(CLASS_CREATOR).val() !== String($p.userId())) {
            // =========================================================
            // パターンA：無効化（グレーアウト）＆クリック時アラート
            // =========================================================
            
            // プリザンター標準のクリックイベント（ダイアログ表示）を消すためにクローンを作成
            var $disabledBtn = $targetBtn.clone(false).removeAttr('onclick');
            
            // グレーアウトのスタイル適用
            $disabledBtn.css({
                'background-color': '#dcdcdc', // グレー
                'border-color': '#cccccc',
                'color': '#888888',
                'font-weight': 'bold',
                'padding': '5px 15px',
                'cursor': 'not-allowed', // 禁止マークのカーソル
                'background-image': 'none'
            });

            // クリック時にアラートを表示（念のため）
            $disabledBtn.on('click', function(e) {
                e.preventDefault();
                alert("作成者以外は情報の入力はできません。");
            });

            // 元のボタンを隠して、無効化ボタンを表示
            $targetBtn.hide().after($disabledBtn);

        } 
        else {
            // =========================================================
            // パターンB：通常表示（作成中 100 の場合）
            // =========================================================
            $targetBtn.css({
                'background-color': '#0056b3',
                'background-image': 'none',
                'border-color': '#004494',
                'color': '#ffffff',
                'font-weight': 'bold',
                'padding': '5px 15px'
            });
        }
    }
    //#endregion
    
    //#region<精算書PDF出力>
    // =========================================================================
    // ▼ PDF出力ボタンの追加と処理
    // =========================================================================
    
    // ボタンの追加（編集画面下部）
    if($p.action() !== 'new'){
        $('#MainCommands').append('<button id="BtnPrintPdfParent" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-document"></span>PDF出力</button>');
    }
    
    // ボタンクリック時の処理
    $('#BtnPrintPdfParent').on('click', async function() {
        
        // 1. 親レコードのIDを取得
        var parentId = $p.id();
        
        // 新規作成時（まだIDがない時）は実行不可
        if (!parentId) {
            alert('レコードが保存されていません。一度保存してから実行してください。');
            return;
        }

        // 2. 利用者名の取得
        var userName = $p.getControl(PARENT_USER_COLUMN).find('option:selected').text().trim();
        if (!userName) {
            userName = $p.getControl(PARENT_USER_COLUMN).text().trim();
        }
        //利用者名の「部署名）」の部分を削除
        userName = userName.split(")")[1];

        if (!confirm('以下の条件でPDFを出力しますか？\n\n・対象：紐付いている全明細\n・利用者：' + userName)) {
            return;
        }

        try {
            // 3. API用のパラメータ作成（親IDを持っている子レコードを検索）
            var json = {
                id: CHILD_TABLE_ID,
                data: {
                    View: {
                        ColumnFilterHash: {
                            // 子の ClassI が このレコードのID と一致するもの
                            [LINK_COLUMN_NAME]: JSON.stringify([String(parentId)])
                        },
                        // 日付順にソート
                        ColumnSorterHash: {
                            [FIELD_MAP.date]: 'asc' 
                        }
                    }
                }
            };

            // 4. データ取得
            var result = await apiGetAsync(json);
            var records = result.Response.Data;

            if (records.length === 0) {
                alert('紐付いている交通費申請データがありません。');
                return;
            }

            // 5. データ整形
            var sendDataList = [];
            console.log("Requestdate: " + $p.getControl(CLASS_REQUESTDATE).text()); //for debug
            records.forEach(function(row) {
                var rowData = {
                    "id": row.IssueId,
                    "date": formatDate(row[FIELD_MAP.date]),
                    "requestdate": $p.getControl(CLASS_REQUESTDATE).text(),  //承認日
                    "user": userName, // 親画面から取得した名前で固定
                    "destination": row[FIELD_MAP.destination],
                    "dep": row[FIELD_MAP.dep],
                    "arr": row[FIELD_MAP.arr],
                    "way": row[FIELD_MAP.way],
                    "trip": row[FIELD_MAP.trip],
                    "amount": row[FIELD_MAP.amount],
                    "memo": row[FIELD_MAP.memo]
                };
                sendDataList.push(rowData);
            });


            // 6. GASへ送信
            $.ajax({
                type: 'POST',
                url: GAS_TRANSREPO_URL,
                contentType: 'text/plain', 
                data: JSON.stringify(sendDataList),
                success: function(response) {
                    try {
                        var resJson = (typeof response === 'object') ? response : JSON.parse(response);
                        if (resJson.pdfBase64) {
                            var bin = atob(resJson.pdfBase64);
                            var buffer = new Uint8Array(bin.length);
                            for (var i = 0; i < bin.length; i++) {
                                buffer[i] = bin.charCodeAt(i);
                            }
                            var pdfBlob = new Blob([buffer.buffer], { type: "application/pdf" });
                            var pdfUrl = window.URL.createObjectURL(pdfBlob);
                            window.open(pdfUrl, '_blank');
                        } else {
                            alert("処理完了: " + resJson.message);
                        }
                    } catch(e) {
                        console.error(e);
                        alert("レスポンスの処理に失敗しました。");
                    }
                },
                error: function(xhr, status, error) {
                    console.error("送信エラー:", error);
                    alert("送信に失敗しました。");
                }
            });

        } catch (e) {
            console.error(e);
            alert('データの取得に失敗しました。コンソールを確認してください。');
        }
    });
    //#endregion

    //#region<経路呼び出し機能（埋め込みパネル版）>
    // =========================================================================
    // ▼ 経路選択パネル（履歴対応・キャッシュ版・順序修正済み）
    // =========================================================================

    // ★定数は上部の<定数定義>リージョンのものを使用します。
    // (FAV_TABLE_ID, HIST_TABLE_ID, CHILD_TABLE_ID, FAV_USER_COL, HIST_USER_COL, PAGE_SIZE は定義済み前提)

    // データを保持しておくための変数（キャッシュ）
    let cachedFavRecords = null;

    // 子レコード作成ボタンを特定
    var $targetBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');

    if ($p.action() !== 'new' && $targetBtn.length > 0) {
        
        // ---------------------------------------------------------
        // 1. パネル用HTMLの生成と挿入
        // ---------------------------------------------------------
        const panelHtml = `
            <div id="CustomRouteContainer" style="clear: both; margin-top: 20px;">
                <h4 id="RoutePanelHeader" style="margin-bottom: 5px; font-weight: bold; color: #333; cursor: pointer; user-select: none;">
                    <span id="RoutePanelToggleIcon" class="ui-icon ui-icon-triangle-1-s" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>経路候補一覧
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

        $('#CustomRouteContainer').remove(); 
        $('#EmbeddedRoutePanel').remove(); 
        $targetBtn.after(panelHtml);

        // ---------------------------------------------------------
        // 2. 関数定義（★ここをタブ初期化より前に移動しました）
        // ---------------------------------------------------------
        
        // ▼ 履歴データの読み込み・描画
        const loadHistoryData = async () => {
            const $histContainer = $('#tab-history');
            const currentUserId = $p.userId();
            const SESSION_KEY_HIST = 'TrafficApp_History';

            // 1. sessionStorageから取得
            let historyList = [];
            const sessionData = sessionStorage.getItem(SESSION_KEY_HIST);
            
            let needsApiFetch = true;
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                console.log("DEBUG: sessiondata");
                console.log(parsed);
                if (parsed.userId === currentUserId && parsed.data) {
                    historyList = parsed.data;
                    if(parsed.data.length > 0){
                        needsApiFetch = false;
                    }
                }
            }
            console.log("DEBUG: sessiondata exist for history data: " + needsApiFetch);
            // 2. APIから取得
            if (needsApiFetch) {
                $histContainer.html('<p style="padding:10px;">履歴を取得中...</p>');
                try {
                    const result = await apiGetAsync({
                        id: HIST_TABLE_ID,
                        data: {
                            View: {
                                ColumnFilterHash: {
                                    [HIST_USER_COL]: JSON.stringify([String(currentUserId)])
                                },
                                ColumnSorterHash: { CreatedTime: 'desc' }
                            },
                            PageSize: 10
                        }
                    });
                    console.log("DEBUG: load history data from API by session storage.");
                    console.log(result);
                    historyList = result.Response.Data || [];
                    
                    const saveObj = {
                        userId: currentUserId,
                        data: historyList
                    };
                    console.log("DEBUG: save history data from API by session storage.");
                    console.log(saveObj);
                    sessionStorage.setItem(SESSION_KEY_HIST, JSON.stringify(saveObj));
                    
                } catch (e) {
                    console.error(e);
                    $histContainer.html('<p style="color:red; margin:10px;">履歴の読み込みに失敗しました。</p>');
                    return;
                }
            }

            // 3. 描画処理
            $histContainer.empty();
            if (historyList.length === 0) {
                $histContainer.html('<p style="color:#666; margin:10px;">履歴はありません。</p>');
            } else {
                let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;">';
                tableHtml += '<thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="width:200px; "padding:5px;">日付</th><th style="width:200px; "padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="padding:5px;">備考</th></tr></thead><tbody>';
                
                const limit = (typeof PAGE_SIZE !== 'undefined') ? PAGE_SIZE : 5;
                historyList.slice(0, limit).forEach(r => {
                    const routeDesc = (r.ClassA || '') + ' → ' + (r.ClassB || '') + 
                                      ' <span style="color:#666;">(' + (r.ClassC || '-') + ')</span>'; 
                    
                    const copyData = {
                        ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumA: r.NumA, 
                        ClassE: $p.getControl('ClassA').val(), 
                        ClassC: $p.getControl('ClassB').val(), 
                        ClassI: String($p.id()),               
                        _mode: 'copy'
                    };
                    const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
                    let dateStr = r.DateA ? new Date(r.DateA).toLocaleDateString() : '-';
                    //add
                    let memoStr = r.Body;

                    tableHtml += `
                        <tr style="border-bottom:1px solid #eee;">
                            <td style="text-align:center; padding: 5px;">
                                <button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button>
                            </td>
                            <td style="padding: 5px;">${dateStr}</td>
                            <td style="padding: 5px;">${routeDesc}</td>
                            <td style="text-align:right; padding: 5px;">${(r.NumA || 0).toLocaleString() + "円"}</td>
                            <td style="padding: 5px;">${memoStr}</td> <!--add-->
                        </tr>
                    `;
                });
                tableHtml += '</tbody></table>';
                $histContainer.html(tableHtml);
            }
        };

        // ▼ お気に入りページ描画
        const renderFavPage = (page) => {
            const $favContainer = $('#tab-fav');
            
            if (!cachedFavRecords || cachedFavRecords.length === 0) {
                $favContainer.html('<p style="color:#666; margin:10px;">登録済みのお気に入り経路はありません。</p>');
                return;
            }

            const limit = (typeof PAGE_SIZE !== 'undefined') ? PAGE_SIZE : 5;
            const totalCount = cachedFavRecords.length;
            const totalPages = Math.ceil(totalCount / limit);
            
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;

            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const displayRecords = cachedFavRecords.slice(startIndex, endIndex);

            let tableHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;">';
            tableHtml += '<thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="padding:5px;">名称</th><th style="padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="width:30px; padding:5px;"></th></tr></thead><tbody>';
            
            displayRecords.forEach(r => {
                const recordId = r.IssueId || r.ResultId || r.Id;
                const routeDesc = (r.ClassA || '') + ' → ' + (r.ClassB || '') + 
                                  ' <span style="color:#666;">(' + (r.ClassC || '-') + ')</span>';
                
                const copyData = {
                    Title: r.Title,
                    ClassA: r.ClassA, ClassB: r.ClassB, ClassD: r.ClassC, NumA: r.NumA, Body: r.Body,
                    ClassE: $p.getControl('ClassA').val(), 
                    ClassC: $p.getControl('ClassB').val(), 
                    ClassI: String($p.id()),               
                    _mode: 'copy'
                };
                const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');

                tableHtml += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="text-align:center; padding: 5px;">
                            <button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button>
                        </td>
                        <td style="padding: 5px;">${r.Title}</td>
                        <td style="padding: 5px;">${routeDesc}</td>
                        <td style="text-align:right; padding: 5px;">${(r.NumA || 0).toLocaleString() + "円"}</td>
                        <td style="text-align:center; padding: 5px;">
                            <button type="button" class="delete-fav-btn ui-button ui-corner-all ui-widget" 
                                    style="padding: 1px 6px; font-size: 11px; color: white; background-color: #d9534f; border: 1px solid #d43f3a; border-radius: 3px;"
                                    title="この経路を削除する" data-id="${recordId}" data-page="${page}">
                                ×
                            </button>
                        </td>
                    </tr>
                `;
            });
            tableHtml += '</tbody></table>';

            if (totalPages > 1) {
                const prevDisabled = (page === 1) ? 'disabled style="opacity:0.5; cursor:default;"' : '';
                const nextDisabled = (page === totalPages) ? 'disabled style="opacity:0.5; cursor:default;"' : '';

                const paginationHtml = `
                    <div style="text-align: center; margin-top: 10px; padding: 5px; border-top: 1px dashed #ddd;">
                        <button type="button" class="fav-page-nav ui-button ui-corner-all ui-widget" data-page="${page - 1}" ${prevDisabled}>&lt; 前へ</button>
                        <span style="margin: 0 15px; font-weight:bold;">${page} / ${totalPages}</span>
                        <button type="button" class="fav-page-nav ui-button ui-corner-all ui-widget" data-page="${page + 1}" ${nextDisabled}>次へ &gt;</button>
                    </div>
                `;
                tableHtml += paginationHtml;
            }
            $favContainer.html(tableHtml);
        };

        // ▼ お気に入りデータ取得
        const fetchAllFavData = async () => {
            const $favContainer = $('#tab-fav');
            $favContainer.html('<p style="padding:10px;">データを取得中...</p>');

            try {
                const currentUserId = $p.userId();
                
                const result = await apiGetAsync({
                    id: FAV_TABLE_ID,
                    data: {
                        View: {
                            ColumnFilterHash: {
                                [FAV_USER_COL]: JSON.stringify([String(currentUserId)])
                            },
                            ColumnSorterHash: { UpdatedTime: 'desc' }
                        },
                        PageSize: 1000 
                    }
                });

                cachedFavRecords = result.Response.Data || [];
                renderFavPage(1);

            } catch (e) {
                console.error(e);
                $favContainer.html('<p style="color:red; margin:10px;">データの読み込みに失敗しました。</p>');
            }
        };

        // ---------------------------------------------------------
        // 3. jQuery UI Tabs の初期化 & イベント (関数定義の後に移動)
        // ---------------------------------------------------------
        $('#RouteTabs').tabs({
            activate: function(event, ui) {
                const panelId = ui.newPanel.attr('id');
                
                // ▼ よく使う経路（履歴）タブ
                if (panelId === 'tab-history') {
                    loadHistoryData();
                }
                // ▼ お気に入り経路タブ
                else if (panelId === 'tab-fav') {
                    if (cachedFavRecords === null) {
                        fetchAllFavData();
                    } else {
                        renderFavPage(1);
                    }
                }
            }
        });

        // 4. 初期表示用
        loadHistoryData();

        // 5. その他イベントハンドラ
        // アコーディオン開閉
        $('#RoutePanelHeader').on('click', function() {
            var $panel = $('#EmbeddedRoutePanel');
            var $icon = $('#RoutePanelToggleIcon');
            $panel.slideToggle(200, function() {
                if ($panel.is(':visible')) {
                    $icon.removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');
                } else {
                    $icon.removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
                }
            });
        });

        // ページ送りボタンイベント
        $(document).off('click', '.fav-page-nav').on('click', '.fav-page-nav', function() {
            const newPage = $(this).data('page');
            if (newPage) renderFavPage(newPage);
        });

        // 削除ボタンクリックイベント
        $(document).off('click', '.delete-fav-btn').on('click', '.delete-fav-btn', async function() {
            if (!confirm("本当にこのお気に入り経路を削除しますか？\n※この操作は元に戻せません。")) return;

            const targetId = String($(this).data('id'));
            const currentPage = $(this).data('page');
            const $btn = $(this);
            $btn.prop('disabled', true).text('...');

            try {
                await apiDeleteAsync(targetId);
                
                cachedFavRecords = cachedFavRecords.filter(r => {
                    const rId = String(r.IssueId || r.ResultId || r.Id);
                    return rId !== targetId;
                });
                renderFavPage(currentPage);

            } catch (e) {
                console.error(e);
                alert("削除に失敗しました。");
                $btn.prop('disabled', false).text('×');
            }
        });
    }

    // 選択ボタンクリック時の処理
    $(document).off('click', '.select-route-btn').on('click', '.select-route-btn', function() {
        const data = $(this).data('json');
        data.ParentId = $p.id();
        sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(data));
        
        const linkCol = (typeof LINK_COLUMN_NAME !== 'undefined') ? LINK_COLUMN_NAME : 'ClassI';
        const targetUrl = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + linkCol + '=' + data.ParentId;
        window.location.href = targetUrl;
    });
    //#endregion

    //#region<画像OCR読込機能>
    // =========================================================================
    // ▼ 画像からレシート/履歴を読み取る機能 (Gemini API連携)
    // =========================================================================

    // ボタン配置（「経路呼出」ボタンの横あたりに追加）
    if ($p.action() !== 'new') {
        // 既存のボタンがあれば削除して再作成（重複防止）
        $('#BtnOcrRead').remove();
        
        // 経路ボタン($targetBtn)の後ろに追加。ファイル選択inputは非表示で配置。
        const ocrBtnHtml = `
            <button id="BtnOcrRead" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px;">
                <span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-image"></span>画像から交通費情報を読取(OCR)
            </button>
            <input type="file" id="OcrFileInput" accept="image/png, image/jpeg" style="display:none;">
        `;
        
        // 経路ボタンの変数がスコープ内にあればそれを使いますが、なければ再取得
        let $anchorBtn = $('button[data-to-site-id="' + CHILD_TABLE_ID + '"]');
        if($anchorBtn.length > 0) {
            // 経路パネル等がある場合はその並びに追加したいので、経路ボタンの直後に追加
            $anchorBtn.after(ocrBtnHtml);
        }
    }

    // 1. ボタンクリックでファイル選択を開く
    $(document).on('click', '#BtnOcrRead', function(e) {
        e.preventDefault();
        $('#OcrFileInput').val(''); // リセット
        $('#OcrFileInput').click();
    });

    // 2. ファイル選択時の処理
    $(document).on('change', '#OcrFileInput', function() {
        const file = this.files[0];
        if (!file) return;

        // ローディング表示
        const $btn = $('#BtnOcrRead');
        const originalText = $btn.html();
        $btn.prop('disabled', true).html('<span class="ui-icon ui-icon-clock"></span>解析中...');

        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;
            executeOcr(base64Data, $btn, originalText);
        };
        reader.readAsDataURL(file);
    });

    // 3. GASへ送信してOCR実行 (jQuery.ajax 改善版)
    const executeOcr = (base64Data, $btn, originalText) => {
        const payload = {
            type: 'ocr',
            imageBase64: base64Data
        };

        $.ajax({
            type: 'POST',
            url: GAS_TRANSREPO_URL,
            data: JSON.stringify(payload), // contentTypeは指定せず、自動判別に任せる手もありますが...
            contentType: 'text/plain',     // GASのdoPostはこれでないと受け取れないことが多い
            dataType: 'json',              // レスポンスはJSONとしてパースする
            
            success: function(response) {
                $btn.prop('disabled', false).html(originalText);
                
                // エラーオブジェクトの判定
                if (response.status === 'error' || response.error) {
                    alert('OCRエラー: ' + (response.message || '詳細不明'));
                    return;
                }

                // 結果処理
                if (Array.isArray(response)) {
                    showOcrResultModal(response);
                } else {
                    showOcrResultModal([response]);
                }
            },
            
            error: function(xhr, status, error) {
                console.error("AJAX Error:", status, error);
                console.log("Response Text:", xhr.responseText); // HTMLが返ってきていないか確認
                
                $btn.prop('disabled', false).html(originalText);
                
                // GAS特有の「リダイレクト先がCORSヘッダーを返さない」問題への対処
                // ステータスが0や200以外でも、responseTextに正しいJSONが入っている場合があります
                if (xhr.responseText) {
                    try {
                        const maybeJson = JSON.parse(xhr.responseText);
                        if (maybeJson && (Array.isArray(maybeJson) || maybeJson.date)) {
                            // エラー扱いされたが中身は正しいJSONだった場合、成功とみなす
                            showOcrResultModal(Array.isArray(maybeJson) ? maybeJson : [maybeJson]);
                            return;
                        }
                    } catch(e) {
                        // JSONパース失敗＝本当にエラー
                    }
                }

                alert('通信に失敗しました。コンソールログを確認してください。\n' + error);
            }
        });
    };

    // 4. 結果選択モーダルの表示
    const showOcrResultModal = (dataList) => {
        $('#OcrResultDialog').remove(); // 既存削除

        let rowsHtml = '';
        dataList.forEach((row, index) => {
            // 金額などのフォーマット
            const amount = row.amount ? Number(row.amount).toLocaleString() : '';
            const date = row.date || '';
            const route = (row.dep || '') + ' → ' + (row.arr || '');
            
            // JSONデータを属性に埋め込む
            const rowJson = JSON.stringify(row).replace(/"/g, '&quot;');

            rowsHtml += `
                <tr>
                    <td style="text-align:center;">
                        <input type="checkbox" class="ocr-check" data-json="${rowJson}" checked>
                    </td>
                    <td>${date}</td>
                    <td>${route} <br><span style="font-size:0.8em;color:#666;">${row.way || ''}</span></td>
                    <td style="text-align:right;">${amount}</td>
                    <td>${row.memo || ''}</td>
                </tr>
            `;
        });

        const dialogHtml = `
            <div id="OcrResultDialog" title="読み取り結果の確認">
                <p>登録する明細を選択してください。</p>
                <table class="grid" style="width:100%; font-size:12px;">
                    <thead>
                        <tr>
                            <th style="width:30px;"><input type="checkbox" id="OcrCheckAll" checked></th>
                            <th style="width:80px;">日付</th>
                            <th>経路 / 手段</th>
                            <th style="width:60px;">金額</th>
                            <th>備考</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;

        $('body').append(dialogHtml);

        $('#OcrResultDialog').dialog({
            modal: true,
            width: 700,
            height: 500,
            buttons: {
                "決定（連続登録へ）": function() {
                    processOcrSelection();
                    $(this).dialog("close");
                },
                "キャンセル": function() {
                    $(this).dialog("close");
                }
            }
        });

        // 全選択/解除
        $('#OcrCheckAll').on('change', function() {
            $('.ocr-check').prop('checked', $(this).prop('checked'));
        });
    };

    // 5. 選択データの処理と遷移
    const processOcrSelection = () => {
        const queue = [];
        const parentId = $p.id();

        // チェックされた行のデータを収集
        $('.ocr-check:checked').each(function() {
            const raw = $(this).data('json');
            // 子画面の項目名に合わせてマッピング
            const mappedData = {
                StartTime: raw.date,     // 利用日
                ClassA: raw.dep,         // 出発
                ClassB: raw.arr,         // 到着
                ClassD: raw.way,         // 交通手段
                NumA: raw.amount,        // 金額
                Body: raw.memo,          // 備考
                
                // 親情報も付与（自動入力用）
                ParentId: parentId,
                ClassE: $p.getControl('ClassA').val(), // 利用者
                ClassC: $p.getControl('ClassB').val(), // 上長
                ClassI: String(parentId),              // 親ID
                
                _mode: 'ocr' // モード識別子
            };
            queue.push(mappedData);
        });

        if (queue.length === 0) {
            alert("登録する明細が選択されていません。");
            return;
        }

        // 最初の1件を取り出す
        const firstData = queue.shift();

        // 残りをキューとして保存 (TrafficApp_OcrQueue)
        sessionStorage.setItem('TrafficApp_OcrQueue', JSON.stringify(queue));
        
        // 最初の1件を自動入力用として保存 (TrafficApp_CopyData)
        sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(firstData));

        // 新規作成画面へ遷移
        const linkCol = (typeof LINK_COLUMN_NAME !== 'undefined') ? LINK_COLUMN_NAME : 'ClassI';
        const targetUrl = '/fs/Items/' + CHILD_TABLE_ID + '/New?' + linkCol + '=' + parentId;
        
        window.location.href = targetUrl;
    };
    //#endregion
    
};