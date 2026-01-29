// 交通費申請レコード　編集画面
$p.events.on_editor_load = function () {
    
    //#region<【重要】リンクエリアの非表示（セキュリティ対策）>
    // =========================================================================
    // ▼ 画面下部の「リンク」セクションを強制的に非表示にする
    //   理由：ここから「従業員一覧」等のマスタ情報へ遷移できてしまうのを防ぐため
    // =========================================================================
    $('head').append('<style>#Links { display: none !important; }</style>');
    //#endregion

    //#region<定数定義>
    //=====================================================================================================================================================
    const gasUrl = 'https://script.google.com/macros/s/AKfycbwv_UdDOkIvyVcz_oAj-1odo4yEWD013cKTs4u3bxXhB0qPvWwS_qAE-ZyKL4SQDh_Q/exec'; // ★あなたのGASのURL
    const CLASS_DEP = 'ClassA'; //「出発駅」欄
    const CLASS_ARR = 'ClassB'; //「到着駅」欄
    const CLASS_TRAFFWAY = 'ClassD'; //「交通手段」欄
    const CLASS_APPLICANT = 'ClassE'; //「利用者」欄
    const CLASS_SUPERIOR = 'ClassC'; //「上長」欄    
    const CLASS_PARENTID = 'ClassI'; //「精算書名」欄
    const CLASS_RECORDNO = 'NumB'; //「精算書内データNo」欄
    const CLASS_ONEWAY = 'ClassH'; //「片道/往復」欄
    const CLASS_COST_ONEWAY = 'NumC'; //「金額(片道)」欄

    // 「片道」と判定する値（選択肢の「値」に合わせて修正してください。通常は文字列なら'片道'、数値ならその数値）
    const VAL_ONEWAY = '片道'; 

    //以下「交通費精算書」テーブル情報
    //-------------------------------------------------------------------------------------
    const TRANSREPOTABLE_ID = 15466053; //従業員一覧　テーブルID
    const COL_LINK_TRANSREPO = 'ClassI'; // 親（精算書）と紐付くリンク項目
    const TRANSREPOTABLE_CLASS_CREATOR = 'ClassD'; //「作成者」欄
    const TRANSREPOTABLE_ID_CREATE = 100;  //状況: 作成中のID
    const TRANSREPOTABLE_ID_REJECT = 910;  //状況: 差し戻しのID
    //-------------------------------------------------------------------------------------

    // 【重要】コピーしたい項目と、親から引き継ぎたい項目の定義
    const FIELDS = [
        { child: 'StartTime',    parent: 'DateA' },  // 利用日
        { child: 'ClassA',       parent: null },     // 出発
        { child: 'ClassB',       parent: null },     // 到着
        { child: 'ClassD',       parent: null },     // 交通手段
        { child: 'Title',       parent: null },     // 行先
        { child: 'ClassH',       parent: null },     // 片道/往復
        { child: 'NumA',         parent: null },     // 金額
        { child: 'NumC',         parent: null },     // 金額(片道)
        { child: 'Body',         parent: null },      // 備考
        { child: 'ClassE',       parent: 'ClassA' },  // 利用者（親からコピー）
        { child: 'ClassC',       parent: 'ClassB' },  // 上長（親からコピー）
        { child: 'ClassI',       parent: 'Id' },       // 親レコードID
        { child: 'NumB',       parent: null }       // 請求書内No
    ];

    //以下「お気に入り経路」テーブル情報
    //-------------------------------------------------------------------------------------
    const FAV_TABLE_ID = 15951290;  //お気に入り経路テーブルID
    //お気に入りテーブル側の項目定義（Dictionary的な使い方）
    const FAV_FIELDS = {
        DEP:   'ClassA', // 出発
        ARR:   'ClassB', // 到着
        WAY:   'ClassC', // 交通手段 (お気に入り側)
        USER:  'ClassD', // 登録ユーザー (お気に入り側)
        COST:  'NumA',   // 金額(片道)
        MEMO:  'Body'    // 備考
    };

    //-------------------------------------------------------------------------------------
    
    //以下「経路履歴」テーブル情報
    //-------------------------------------------------------------------------------------
    const HIST_TABLE_ID = 15960204; // ★【要修正】履歴テーブルID
    const SESSION_KEY_HIST = 'TrafficApp_History';
    const HIST_USER_COL = 'ClassD'; // お気に入りマスタのユーザーID項目
    const HIST_REGISTQTY = 5; //経路履歴最大保存件数
    //-------------------------------------------------------------------------------------

    // 読み取り専用化
    $p.getControl(CLASS_APPLICANT).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});
    $p.getControl(CLASS_SUPERIOR).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});
    $p.getControl(CLASS_PARENTID).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});
    $p.getControl(CLASS_RECORDNO).prop('readonly', true).css({'pointer-events': 'none', 'background-color': '#eee'});

    //-------------------------------------------------------------------------------------
    //sessionStorageデータの取得（コピー、次区間、お気に入り等）
    const previousDataJson = sessionStorage.getItem('TrafficApp_CopyData');
    let inputData = previousDataJson ? JSON.parse(previousDataJson) : {};
    // 使用済みのsessionStorageをクリア
    if (previousDataJson) {
        sessionStorage.removeItem('TrafficApp_CopyData');
    }
    //=====================================================================================================================================================
    //ここまで定数定義
    //#endregion

    //#region<関数定義>
    //=====================================================================================================================================================
    // ▼Promise化用のヘルパー関数
    const apiGetAsync = (jsonfile) => {
        return new Promise((resolve, reject) => {
            jsonfile.done = function(data) { resolve(data); };
            jsonfile.fail = function(data) { reject(data); };
            $p.apiGet(jsonfile);
        });
    };
    const apiCreateAsync = (jsonfile) => {
        return new Promise((resolve, reject) => {
            jsonfile.done = function(data) { resolve(data); };
            jsonfile.fail = function(data) { reject(data); };
            $p.apiCreate(jsonfile);
        });
    };
    const apiUpdateAsync  = (jsonfile) => {
        return new Promise((resolve, reject) => {
            jsonfile.done = function(data) { resolve(data); };
            jsonfile.fail = function(data) { reject(data); };
            $p.apiUpdate(jsonfile);
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
    // ▼ API送信用データ作成関数
    const buildApiPayload = (fieldsConfig, linkColumn, linkValue) => {
        var data = {
            ClassHash: {},
            NumHash: {},
            DateHash: {},
            DescriptionHash: {},
            CheckHash: {}
        };

        if(linkColumn && linkValue) {
            data.ClassHash[linkColumn] = linkValue;
        }

        fieldsConfig.forEach(function(field) {
            var key = field.child;
            if (key === linkColumn && linkValue) {
                return;
            }
            var control = $p.getControl(key);
            
            if(control.length === 0) return;

            var val = control.val();

            // --- ルート項目の判定 ---
            var rootItems = ['Title', 'Body', 'StartTime', 'CompletionTime', 'WorkValue', 'ProgressRate', 'RemainingWorkValue', 'Status', 'Manager', 'Owner', 'Locked', 'Comments'];
            
            if (rootItems.indexOf(key) !== -1) {
                if(key.indexOf('Time') !== -1 && val === "") {
                    return; 
                }
                if((key === 'WorkValue' || key === 'ProgressRate') && val !== "") {
                    data[key] = parseFloat(val);
                    return;
                }
                data[key] = val;
                return; 
            }

            // --- Hash項目の判定 ---
            if (key.match(/^Class/)) {
                data.ClassHash[key] = val;
            } 
            else if (key.match(/^Num/)) {
                if (val !== "") {
                    var numVal = parseFloat(val.replace(/,/g, ''));
                    if(!isNaN(numVal)){
                        data.NumHash[key] = numVal;
                    }
                }
            } 
            else if (key.match(/^Date/)) {
                if (val !== "") {
                    data.DateHash[key] = val;
                }
            } 
            else if (key.match(/^Description/)) {
                data.DescriptionHash[key] = val;
            } 
            else if (key.match(/^Check/)) {
                data.CheckHash[key] = control.prop('checked');
            }
        });

        return data;
    };
    // ▼ 必須入力チェック関数
    const validateRequiredFields = () => {
        let errorFields = [];

        FIELDS.forEach(function(field) {
            let colName = field.child;
            let control = $p.getControl(colName);
            
            if(control.length === 0) return;

            let isRequired = control.attr('data-validate-required') || control.prop('required');

            if (isRequired) {
                let val = control.val();
                if (val === "" || val === null || val === undefined) {
                    let labelText = $p.getField(colName).find('.control-label').text() || colName;
                    labelText = labelText.replace('必須', '').trim();
                    errorFields.push(labelText);
                }
            }
        });

        if (errorFields.length > 0) {
            alert('以下の必須項目が入力されていません：\n\n・' + errorFields.join('\n・'));
            return false;
        }
        return true;
    };
    // ▼ 親IDをDOMまたはURLから確実に取得する関数
    const getParentId = () => {
        let val = $p.getControl(COL_LINK_TRANSREPO).val();
        if (val) return val;
        val = inputData.ParentId;
        if (val) return val;
        const params = new URLSearchParams(window.location.search);
        return params.get('LinkId');
    };
    
    // ▼ 履歴登録処理関数（重複入替・最新先頭維持版）
    const addToHistoryAsync = async () => {
        // --- 1. 保存データの構築 ---
        const rawNum = $p.getControl(CLASS_COST_ONEWAY).val();
        const costVal = rawNum ? parseFloat(rawNum.replace(/,/g, '')) : 0;

        const newRecord = {
            Title:  $p.getControl('Title').val(),      // 行先
            DateA:  $p.getControl('StartTime').val(),  // 利用日
            ClassA: $p.getControl(CLASS_DEP).val(),    // 出発
            ClassB: $p.getControl(CLASS_ARR).val(),    // 到着
            ClassC: $p.getControl(CLASS_TRAFFWAY).val(), // 交通手段
            NumA:   costVal,                           // 金額
            ClassD: String($p.userId()),               // 登録ユーザー
            Body:   $p.getControl('Body').val(),       // 備考
        };

        // 必須項目（出発・到着）が空なら履歴保存しない
        if (!newRecord.ClassA || !newRecord.ClassB) {
            console.log("DEBUG: History skip (Required fields empty).");
            return;
        }

        // --- 2. セッションから現在の履歴リストを取得 ---
        let historyList = [];
        const sessionData = sessionStorage.getItem(SESSION_KEY_HIST);
        if (sessionData) {
            try {
                const parsed = JSON.parse(sessionData);
                // ユーザーIDが一致する場合のみ採用（別ユーザーでのログイン対策）
                if (String(parsed.userId) === String($p.userId())) {
                    historyList = parsed.data || [];
                }
            } catch (e) {
                historyList = [];
            }
        }

        // --- 3. 重複チェック（出発・到着・手段・金額） ---
        // ※完全に一致するデータが既にあるか探す
        const duplicateIndex = historyList.findIndex(r => {
            return r.ClassA === newRecord.ClassA &&
                   r.ClassB === newRecord.ClassB &&
                   r.ClassC === newRecord.ClassC &&
                   r.NumA   === newRecord.NumA;
        });

        // --- 4. 重複データの削除（サーバー & 配列） ---
        if (duplicateIndex !== -1) {
            console.log("DEBUG: Duplicate found at index " + duplicateIndex + ". Removing old record...");
            
            const oldRecord = historyList[duplicateIndex];
            const deleteId = oldRecord.IssueId || oldRecord.ResultId || oldRecord.Id;

            // サーバーから削除（非同期・待機しない）
            if (deleteId) {
                apiDeleteAsync(deleteId).catch(e => console.error("Old history delete failed", e));
            }
            // 配列から削除
            historyList.splice(duplicateIndex, 1);
        }

        // --- 5. 新規レコードをサーバーに登録 ---
        try {
            // $p.apiCreate 用データ（フラット構造）
            const apiData = {
                Title:  newRecord.Title,
                DateA:  newRecord.DateA,
                ClassA: newRecord.ClassA,
                ClassB: newRecord.ClassB,
                ClassC: newRecord.ClassC,
                ClassD: newRecord.ClassD,
                NumA:   newRecord.NumA,
                Body:   newRecord.Body
            };

            const res = await apiCreateAsync({
                id: HIST_TABLE_ID,
                data: apiData
            });

            // ID取得（レスポンス形式に合わせて調整）
            const createdId = res.Id || (res.Response && res.Response.Data && res.Response.Data.Id);
            
            if (!createdId) {
                console.warn("DEBUG: Created ID not found in response.", res);
            }

            // --- 6. 履歴リストの先頭に追加 ---
            // 次回の削除用にIDを含めたオブジェクトを作成
            const createdRecord = {
                Id: createdId,
                IssueId: createdId,
                ResultId: createdId,
                ...newRecord // 入力データを展開
            };
            
            historyList.unshift(createdRecord);

            // --- 7. 件数制限（最大5件）オーバーの削除 ---
            if (historyList.length > HIST_REGISTQTY) {
                const itemToDelete = historyList.pop(); // 末尾（一番古い）を取り出す
                const deleteId = itemToDelete.IssueId || itemToDelete.ResultId || itemToDelete.Id;
                
                if (deleteId) {
                    apiDeleteAsync(deleteId).catch(e => console.error("Overflow delete failed", e));
                }
            }

            // --- 8. セッション情報の更新 ---
            const saveObj = {
                userId: $p.userId(),
                data: historyList
            };
            sessionStorage.setItem(SESSION_KEY_HIST, JSON.stringify(saveObj));
            console.log("DEBUG: History updated successfully.");

        } catch (e) {
            console.error("History add failed:", e);
        }
    };

    //=====================================================================================================================================================
    //関数定義はここまで
    //#endregion

    //#region<親ステータスチェック（直接URLアクセス対策・修正版）>
    // =========================================================================
    // ▼ 親レコードのステータス(ID)を確認し、編集不可なら画面をロックする
    // =========================================================================
    (async () => {
        try {
            // 親IDを取得
            const parentId = getParentId();
            if (!parentId) return;

            // 親レコードの情報を取得
            const result = await apiGetAsync({
                id: parentId
            });

            if (result.Response.Data.length > 0) {
                const parentRecord = result.Response.Data[0];
                // API経由だとステータスは「ID(数値)」で返ってきます (例: 100)
                const pStatusId = parentRecord.Status; 

                // 許可するステータスID
                const ALLOWED_STATUS_IDS = [TRANSREPOTABLE_ID_CREATE, TRANSREPOTABLE_ID_REJECT];

                if (!ALLOWED_STATUS_IDS.includes(pStatusId) || String(parentRecord[TRANSREPOTABLE_CLASS_CREATOR]) !== String($p.userId())) {
                    console.log("Block Edit: Parent status ID is " + pStatusId);
                    
                    // アラート表示
                    alert(`親レコードのステータス(ID:${pStatusId})が編集可能な状態ではないため、\nこの明細の作成・編集・削除はできません。`);

                    // 画面ロック処理
                    $('#MainCommands').empty(); 
                    $('#MainCommands').append('<button id="GoBackBlocked" class="button button-icon ui-button ui-corner-all ui-widget">戻る</button>');
                    $('#GoBackBlocked').on('click', function(e){
                        e.preventDefault();
                        window.location.href = '/fs/Items/' + parentId;
                    });

                    $('input, select, textarea, button').prop('disabled', true);
                    $('.ui-datepicker-trigger').hide(); 
                    $('#MyCalcButton, #BtnRegistFav, #BtnOcrRead').remove();
                    $('#CustomRouteContainer').hide(); 
                }
            }
        } catch (e) {
            console.error("親ステータスチェックに失敗", e);
        }
    })();
    //#endregion

    //#region<交通費精算書から自動で情報入力>
    // =========================================================================
    // 1. 画面ロード時の処理（データの自動入力）
    // =========================================================================
    console.log('現在は: ' + $p.action());
    if ($p.action() === 'new' || $p.action() === 'New'){
        
        (async () => {
            try {
                const parentId = getParentId();
                console.log("DEBUG: Retrieved ParentId = " + parentId); // デバッグ用

                // 親レコード情報の取得が必要か判定
                // (sessionStorageがない、または お気に入りコピー等の場合でも親情報は最新を取りたい)
                let parentRecord = null;
                if (parentId) {
                    let result = await apiGetAsync({
                        id: TRANSREPOTABLE_ID,
                        data: {
                            View: { ColumnFilterHash: { ListingId: parentId } }
                        }
                    });
                    if (result.Response.Data.length > 0) {
                        parentRecord = result.Response.Data[0];
                    }
                }

                // (B) データのマージと加工
                if (inputData._mode === 'nextLeg') {
                    // --- 次の区間モード ---
                    inputData[CLASS_DEP] = inputData[CLASS_ARR] || '';
                    inputData[CLASS_ARR] = '';
                    inputData['NumA'] = '';
                    inputData['NumC'] = '';
                    // ※親情報はinputDataに既に含まれていることが多いが、最新で上書きしても良い
                }

                // (C) 画面へのセット処理
                FIELDS.forEach(function(field) {
                    // Noは自動採番するのでスキップ
                    if (field.child === CLASS_RECORDNO) return; 

                    let valToSet = null;

                    // 優先順位1: sessionStorage (inputData) に値がある場合
                    if (inputData.hasOwnProperty(field.child)) {
                        valToSet = inputData[field.child];
                    }
                    
                    // 優先順位2: 親レコードから引き継ぐ設定(parent)があり、親データが取れている場合
                    // ※ただし、inputDataにお気に入り情報が入っている場合(Titleなど)はそちらを優先したいので
                    //   valToSetがnull/undefinedの場合のみ親から取る、というロジックにします。
                    if ((valToSet === null || valToSet === undefined || valToSet === "") && 
                        field.parent && parentRecord && parentRecord[field.parent]) {
                        
                        let parentVal = parentRecord[field.parent];
                        // 日付フォーマット調整
                        if (typeof parentVal === 'string' && parentVal.match(/^\d{4}-\d{2}-\d{2}T/)) {
                            parentVal = parentVal.split('T')[0].replace(/-/g, '/');
                        }
                        valToSet = parentVal;
                    }

                    // 値セット（nullでなければ）
                    if (valToSet !== null && valToSet !== undefined) {
                        $p.set($p.getControl(field.child), valToSet);
                    }
                });

                // 親IDリンクのセット
                if (inputData[COL_LINK_TRANSREPO]) {
                    $p.set($p.getControl(COL_LINK_TRANSREPO), inputData[COL_LINK_TRANSREPO]);
                } else if (parentId) {
                    $p.set($p.getControl(COL_LINK_TRANSREPO), parentId);
                }

            } catch (e) {
                console.error('自動入力処理でエラー:', e);
            }
        })();
        
        console.log('DEBUG: CURRENT record No:' + $p.getControl(CLASS_RECORDNO).val());
    }
    //#endregion

    //#region<自動採番 & コピー時の戻るボタン制御>
    // =========================================================================
    // ★ DBの「最大値+1」を計算 & コピー作成時の「ゴミデータ削除」機能
    // =========================================================================
    (async () => {
        try {
            // (A) sessionStorageデータの取得（コピー、次区間、お気に入り等）
            const previousDataJson = sessionStorage.getItem('TrafficApp_CopyData');
            let inputData = previousDataJson ? JSON.parse(previousDataJson) : {};
            // 親IDを取得
            const parentId = getParentId();
            
            // 親IDがある場合のみ実行
            if(parentId){
                // 1. 兄弟レコードを全件取得
                let result = await apiGetAsync({
                    id: $p.siteId(),
                    data: {
                        View: {
                            ColumnFilterHash: {
                                [COL_LINK_TRANSREPO]: JSON.stringify([String(parentId)])
                            },
                            ColumnSorterHash: {
                                [CLASS_RECORDNO]: 'desc' // 降順にしておくと先頭がMax
                            }
                        }
                    }
                });
                
                let records = result.Response.Data;
                let nextNum = 1;
                let maxNum = 0;

                // 2. 最大値を計算
                if (records.length > 0) {
                    let numList = records.map(r => {
                        let n = parseFloat(r[CLASS_RECORDNO]);
                        return isNaN(n) ? 0 : n;
                    });
                    maxNum = Math.max(...numList);
                }

                // 現在の画面の値
                let currentVal = parseFloat($p.getControl(CLASS_RECORDNO).val());
                if(isNaN(currentVal)) currentVal = 0;
                
                // -------------------------------------------------------------
                // ★ ここから分岐ロジック
                // -------------------------------------------------------------
                if ($p.action() === 'new' || $p.action() === 'New') {
                    // 新規作成画面：無条件で Max + 1
                    nextNum = maxNum + 1;
                    $p.set($p.getControl(CLASS_RECORDNO), nextNum);
                    console.log("DEBUG(New): Set Number to " + nextNum);

                } else {
                    // 編集画面(Edit)：重複チェックを行う
                    // 「自分以外のレコード」で「現在の自分の番号(currentVal)」と同じやつがいるか？
                    let myId = $p.id();
                    
                    let isDuplicate = records.some(function(r) {
                        // 文字列比較でIDが違う かつ 番号が同じものがあるか
                        return (String(r.IssueId) !== String(myId)) && (parseFloat(r[CLASS_RECORDNO]) === currentVal);
                    });

                    if (isDuplicate) {
                        console.log("DEBUG(Edit): Duplicate detected! It's a COPY record.");
                        
                        // (1) 番号を最新に書き換える
                        nextNum = maxNum + 1;
                        $p.set($p.getControl(CLASS_RECORDNO), nextNum);
                        
                        // (2) 新規情報に上書きする
                        try {
                            const safeParentId = getParentId();

                            if (!safeParentId) {
                                alert("親レコードIDが取得できませんでした。");
                            }

                            let updateData = buildApiPayload(FIELDS, COL_LINK_TRANSREPO, safeParentId);
                            
                            await apiUpdateAsync({
                                id: $p.id(),
                                data: updateData
                            });
                        } catch (e) {
                            console.error('Save Error:', e);
                            alert('保存に失敗しました。');
                        }
                                        
                    } else {
                        console.log("DEBUG(Edit): No duplicate. Safe.");
                    }
                }
            }
        } 
        catch(e) {
            console.error('Auto-numbering failed:', e);
        }
    })();
    //#endregion
    
    //#region<保存ボタン表示・処理>
    // =========================================================================
    // 2. ボタンの整備 (OCR連続登録対応版)
    // =========================================================================
    
    $('#CreateCommand').hide();
    // ---------------------------------------------------------
    // 「保存せずに戻る」ボタンのカスタマイズ
    // ---------------------------------------------------------
    // 1. テキスト変更
    $('#GoBack').contents().filter(function() { return this.nodeType === 3; }).replaceWith('保存せずに戻る');

    // 2. クリック動作の上書き (標準動作を無効化して親画面へ遷移)
    // ※プリザンターの標準イベントを外して、独自の遷移処理を入れる
    $('#GoBack').off('click').on('click', function(e) {
        e.preventDefault(); // 標準動作（一覧へ戻る）をキャンセル

        // 親IDを取得
        const parentId = getParentId();

        // 遷移先URLの決定
        // 親IDがあれば親レコード編集画面へ、なければサイトトップ（一覧）へ
        const targetUrl = parentId ? '/fs/Items/' + parentId : '/fs/Items/' + $p.siteId();

        // セッションゴミ掃除（念のため）
        sessionStorage.removeItem('TrafficApp_CopyData');
        sessionStorage.removeItem('TrafficApp_OcrQueue');

        // 画面遷移
        window.location.href = targetUrl;
    });

    // --- OCRキューの確認 ---
    const ocrQueueJson = sessionStorage.getItem('TrafficApp_OcrQueue');
    const ocrQueue = ocrQueueJson ? JSON.parse(ocrQueueJson) : [];
    const isOcrMode = ocrQueue.length > 0;

    if (isOcrMode) {
        // ★OCR連続登録モードの場合
        // 他のボタンは隠す（誤操作防止）
        $('#MainCommands').children().hide();
        
        // 「保存して次へ」ボタンを作成
        const btnText = `保存して次の登録に進む (残り${ocrQueue.length}件)`;
        const $ocrNextBtn = $('<button id="BtnOcrNext" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-arrowthick-1-e"></span>' + btnText + '</button>');
        
        $('#MainCommands').append($ocrNextBtn);

        // クリックイベント
        $ocrNextBtn.on('click', async function() {
            if (!validateRequiredFields()) return;
            
            // 保存実行
            await saveAndRedirect('ocr_continue');
        });

        // 「中断して戻る」ボタンも念のため配置
        const $ocrCancelBtn = $('<button class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left:10px;">中断して戻る</button>');
        $ocrCancelBtn.on('click', function(){
            if(confirm('連続登録を中断しますか？\n(未登録のデータは破棄されます)')){
                sessionStorage.removeItem('TrafficApp_OcrQueue');
                sessionStorage.removeItem('TrafficApp_CopyData');
                const parentId = getParentId();
                const targetUrl = parentId ? '/fs/Items/' + parentId : '/fs/Items/' + $p.siteId();
                window.location.href = targetUrl;
            }
        });
        $('#MainCommands').append($ocrCancelBtn);

    } else {
        // ★通常モード（既存のボタン配置）
        
        // (B) 保存してコピー
        $('#MainCommands').append('<button id="BtnSaveAndNext" class="button button-icon ui-button ui-corner-all ui-widget" title="現在の内容をコピーして新規作成画面を開きます"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-copy"></span>保存してコピーを作成</button>');
        $('#BtnSaveAndNext').on('click', async function() {
            if (!validateRequiredFields()) return;
            if (!confirm('保存して、同じ内容をコピー作成しますか？')) return;
            storeCurrentData('copy');
            await saveAndRedirect('next');
        });

        // (B-2) 保存して次の区間へ
        $('#MainCommands').append('<button id="BtnSaveAndNextLeg" class="button button-icon ui-button ui-corner-all ui-widget" title="到着駅を出発駅に設定し、次の移動を入力します"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-arrowreturnthick-1-e"></span>保存して次の区間へ</button>');
        
        // ボタン表示制御
        const toggleNextLegButton = () => {
            const isOneWay = $p.getControl(CLASS_ONEWAY).val() === VAL_ONEWAY;
            if (isOneWay) { $('#BtnSaveAndNextLeg').show(); } else { $('#BtnSaveAndNextLeg').hide(); }
        };
        toggleNextLegButton();
        $p.on('change', CLASS_ONEWAY, function () { toggleNextLegButton(); });

        $('#BtnSaveAndNextLeg').on('click', async function() {
            if (!validateRequiredFields()) return;
            if (!confirm('保存して、次の目的地（区間）の入力へ進みますか？')) return;
            storeCurrentData('nextLeg');
            await saveAndRedirect('next');
        });

        // (C) 保存して戻る
        if($p.action() === 'new'){
            $('#MainCommands').append('<button id="BtnSaveAndReturn" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-check"></span>保存して戻る</button>');
        }
        $('#BtnSaveAndReturn').on('click', async function() {
            if (!validateRequiredFields()) return;
            if (!confirm('保存して、精算書（親画面）に戻りますか？')) return;
            sessionStorage.removeItem('TrafficApp_CopyData');
            await saveAndRedirect('parent');
        });
    }

    // ▼ データ一時保存関数（通常モード用）
    const storeCurrentData = (mode) => {
        let currentInput = {};
        FIELDS.forEach(function(field) {
            if(field.child !== CLASS_RECORDNO){
                currentInput[field.child] = $p.getControl(field.child).val();
            }
        });
        currentInput._mode = mode;
        currentInput.ParentId = getParentId(); // 親IDも保持
        sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(currentInput));
    };

    // (D) 共通保存処理関数（OCR対応版）
    const saveAndRedirect = async (mode) => {
        console.log("Start to save... Mode:" + mode);
        try {
            const safeParentId = getParentId();
            if (!safeParentId) { 
                alert("親レコードIDが取得できませんでした。保存を中断します。"); 
                return;
            }

            let createData = buildApiPayload(FIELDS, COL_LINK_TRANSREPO, safeParentId);
            
            await apiCreateAsync({
                id: $p.siteId(),
                data: createData
            });

            // 経路履歴への登録処理（保存成功後に行う）
            // エラーになってもメイン処理は止めないよう catch する、または関数内で catch 済み
            await addToHistoryAsync();
            
            // 遷移先決定ロジック
            let targetUrl = '';
            
            if (mode === 'ocr_continue') {
                // --- OCR連続登録処理 ---
                // 1. 次のデータを取り出す
                const nextData = ocrQueue.shift();
                
                if (nextData) {
                    // 2. 次のデータをCopyDataにセット（これが次の画面の初期値になる）
                    sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(nextData));
                    // 3. 減ったキューを保存し直す
                    sessionStorage.setItem('TrafficApp_OcrQueue', JSON.stringify(ocrQueue));
                    
                    // 4. 新規作成画面をリロード（新しい初期値で表示される）
                    targetUrl = '/fs/Items/' + $p.siteId() + '/New?' + COL_LINK_TRANSREPO + '=' + safeParentId;
                
                } else {
                    // 5. キューが空になったら完了
                    sessionStorage.removeItem('TrafficApp_OcrQueue'); // 掃除
                    alert("すべての読み取りデータの登録が完了しました。");
                    targetUrl = '/fs/Items/' + safeParentId; // 親画面へ
                }

            } else if (mode === 'next') {
                targetUrl = '/fs/Items/' + $p.siteId() + '/New?' + COL_LINK_TRANSREPO + '=' + safeParentId;
            } else {
                targetUrl = '/fs/Items/' + (safeParentId || $p.siteId());
            }

            $(window).off('beforeunload');
            window.location.href = targetUrl;

        } catch (e) {
            console.error('Save Error:', e);
            alert('保存に失敗しました。');
        }
    };
    //#endregion

    //#region<駅すぱあと for web 出力機能>
    //============================================================================================================================================
    let myBtn = '<button id="MyCalcButton" type="button" class="button button-icon ui-button ui-corner-all ui-widget">交通費を計算</button>';
    
    var targetField = $p.getField('NumA');
    if(targetField.length > 0){
        $('#' + targetField[0].id).after(myBtn);
    }

    $('#MyCalcButton').on('click', function() {
        if($p.getControl(CLASS_DEP).val()=='' || $p.getControl(CLASS_ARR).val()==''){
            alert('出発駅と到着駅の両方に駅名を入力してください。');
            return;
        }
        
        $(this).text('計算中...');

        let newWin = window.open('', '_blank');
        if(newWin) {
            newWin.document.write("検索結果を取得中...");
        } else {
            alert("ポップアップがブロックされました。ブラウザの設定を確認してください。");
            $('#MyCalcButton').text('交通費を計算');
            return;
        }

        let requestData = {
            from: $p.getControl(CLASS_DEP).val(),
            to: $p.getControl(CLASS_ARR).val()
        };
        // 経由地があれば追加
        if($p.getControl('ClassF').length > 0 && $p.getControl('ClassF').val() !== ''){
            requestData.via = $p.getControl('ClassF').val();
        }

        $.ajax({
            type: 'GET',
            url: gasUrl,
            data: requestData,
            dataType: 'json',
            success: function(data) {
                $('#MyCalcButton').text('交通費を計算');
                if(data.error) {
                    alert("エラー: " + data.error);
                    newWin.close();
                } else {
                    if(data.ResultSet && data.ResultSet.ResourceURI) {
                        newWin.location.href = data.ResultSet.ResourceURI;
                    } else {
                        newWin.document.write("検索結果URLが取得できませんでした。");
                    }
                }
            },
            error: function(err) {
                $('#MyCalcButton').text('交通費を計算');
                alert("通信エラーが発生しました");
                newWin.close();
            }
        });
    });
    //#endregion

    //#region<お気に入り経路登録>
    // =========================================================================
    // ▼ お気に入り登録機能
    // =========================================================================

    // ボタン追加
    if ($p.id()) { 
        $('#MainCommands').append('<button id="BtnRegistFav" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-star"></span>お気に入り登録</button>');
    }

    $('#BtnRegistFav').on('click', async function() {
        const routeName = prompt("この経路の「お気に入り名」を入力してください。\n（例：自宅⇔本社、A社訪問ルート 等）");
        
        if (routeName === null) return; 
        if (routeName === "") {
            alert("名称が未入力です。");
            return;
        }

        // 保存データの構築
        const data = {
            Title: routeName, // タイトルは定数化せずそのままでOK
            ClassHash: {
                // ★ブラケット記法 [] を使うことで、定数の値をキーとして展開できます
                [FAV_FIELDS.DEP]:  $p.getControl(CLASS_DEP).val(), // 出発
                [FAV_FIELDS.ARR]:  $p.getControl(CLASS_ARR).val(), // 到着
                [FAV_FIELDS.WAY]:  $p.getControl(CLASS_TRAFFWAY).val(),  // 交通手段 (子はClassD)
                [FAV_FIELDS.USER]: $p.userId()                     // 登録ユーザー
            },
            NumHash: {
                [FAV_FIELDS.COST]: parseFloat($p.getControl(CLASS_COST_ONEWAY).val().replace(/,/g, '')) || 0
            },
            [FAV_FIELDS.MEMO]: $p.getControl('Body').val() // 備考 (ルート項目なのでHashの外)
        };

        try {
            await apiCreateAsync({
                id: FAV_TABLE_ID,
                data: data
            });
            alert("お気に入り経路に保存しました。");
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました。");
        }
    });
    //#endregion

};