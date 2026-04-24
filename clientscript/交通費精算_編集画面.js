// 交通費申請　編集画面

//#region<使用環境毎の設定定数> ※新環境でこのスクリプトを導入する際は必ずここの定数に値を書き加えること。
//===============================================================================================================================================
//以下@siteid list start以下はサイトパッケージエクスポートにて自動変換されるため手での修正不要
// @siteid list start@
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

//===============================================================================================================================================
//#endregion

$p.events.on_editor_load = function () {

    //#region<標準の離脱警告ポップアップ無効化>
    const disableDefaultWarning = () => {
        $(window).off('beforeunload'); 
        window.onbeforeunload = null;  
    };
    disableDefaultWarning();
    $(document).on('change keyup', 'input, select, textarea', function() {
        setTimeout(disableDefaultWarning, 10);
    });
    //#endregion

    //#region<定数定義>
    const currentUserId = String($p.userId());

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
    const PARENT_CHECKED_LIST_COL = 'DescriptionA'; 
    const PAYWAY_INDIV = '個別支払';    

    const LINK_COLUMN_NAME = 'ClassI'; 
    const PARENT_USER_COLUMN = 'ClassA'; 


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

    const TRAFREC_CLASS_DATANO = 'NumB';
    const TRAFREC_CLASS_ACCCHECK = 'CheckA';   
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

    // const FAV_USER_COL = 'ClassD'; 
    // const FAV_CLASS_NAME = 'Title';
    // const FAV_FIELD_MAP = {
    //     title:       'Title',
    //     destination: 'ClassE',
    //     dep:         'ClassA',
    //     arr:         'ClassB',
    //     way:         'ClassC',
    //     amount:      'NumA',
    //     memo:        'Body'
    // };

    // const HIST_USER_COL = 'ClassD'; 
    // const HIST_REGISTDATE = 'DateA';
    // const HIST_MEMO = 'Body';
    // const HIST_REGISTQTY = 5;

    // const PAGE_SIZE = 5; 
    // const HIST_FIELD_MAP = {
    //     destination: 'Title',
    //     dep:         'ClassA',
    //     arr:         'ClassB',
    //     way:         'ClassC',
    //     amount:      'NumA'
    // };

    const SESSION_KEY_ACC_EDITABLE = 'TrafficApp_GeneralAffairsEditable'

    // =========================================================================
    // 指定項目読み取り専用化
    const setReadOnlyStyle = (selector) => {
        const $ctrl = $p.getControl(selector);
        const $dateFieldWrapper = $ctrl.closest('date-field');
        if ($dateFieldWrapper.length > 0) {
            $dateFieldWrapper.before($ctrl);
            $dateFieldWrapper.remove();
        }
        $ctrl.prop('readonly', true).css({
            'pointer-events': 'none',
            'cursor': 'default'
        });
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

    const updateChildOrder = async () => {
        const $rows = $(`table[data-id="${CHILD_TABLE_ID}"] tbody tr`);
        if ($rows.length === 0) return true; 

        let updatePromises = [];
        let needUpdate = false;

        $rows.each(function (index) {
            const $row = $(this);
            const recordId = $row.data('id'); 
            if (!recordId) return;

            const correctNo = index + 1;
            updatePromises.push(
                apiUpdateAsync(recordId, { [TRAFREC_CLASS_DATANO]: correctNo })
            );
            needUpdate = true;
        });

        if (needUpdate) {
            $('#MainContainer').css('opacity', '0.5'); 
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

    //#region<<経路選択・お気に入り経路パネルのUI構築>>
    // サーバ側で作ったパネルを、希望の位置に瞬間移動させる
    if ($('#TempRoutePanel').length > 0) {
        const $panel = $('#TempRoutePanel').children();
        
        // ユーザー様カスタマイズ：子テーブル（#Issues_Source5）の直前に挿入
        $('#Issues_Source5').before($panel);
        
        $('#TempRoutePanel').remove();
    }
    
    if ($("#RouteTabs").length > 0) {
        $("#RouteTabs").tabs();
    }

    $(document).on('click', '#RoutePanelHeader', function() {
        $('#EmbeddedRoutePanel').slideToggle(200, function() {
            if ($(this).is(':visible')) {
                $('#RoutePanelToggleIcon').removeClass('ui-icon-circle-plus').addClass('ui-icon-circle-minus');
            } else {
                $('#RoutePanelToggleIcon').removeClass('ui-icon-circle-minus').addClass('ui-icon-circle-plus');
            }
        });
    });

     $(document).off('click', '.delete-fav-btn').on('click', '.delete-fav-btn', async function() {
        if (!confirm("本当に削除しますか？")) return;

        const $row = $(this).closest('tr');
        try {
            // データ削除処理
            await apiDeleteAsync(String($(this).data('id')));

            // 表示削除処理
            $row.fadeOut(300, function() {
                $(this).remove(); // 完全にHTMLから削除

                // 💡 おまけの親切設計：もし最後の1件を削除して表が空になったらメッセージを出す
                if ($('#tab-fav tbody tr').length === 0) {
                    $('#tab-fav').html('<p style="margin:10px;">お気に入り経路がありません。</p>');
                }
            });

        } catch (e) { alert("削除に失敗しました。"); }
    });

    $(document).on('click', '.select-route-btn', function() {
        const dataStr = $(this).attr('data-json');
        if (!dataStr) return;

        const data = JSON.parse(dataStr);

        data.ParentId = $p.id();
        sessionStorage.setItem('TrafficApp_CopyData', JSON.stringify(data));
        window.location.href = URL_PASS + '/Items/' + CHILD_TABLE_ID + '/New?' + LINK_COLUMN_NAME + '=' + data.ParentId;
    });
    //#endregion

    const initInputSupportUI = ($targetBtn) => {    
        //#region<<OCRボタン>>
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
                
                // ★修正: 対象を明確に指定
                const targetTable = document.querySelector('#Issues_Source' + CHILD_TABLE_ID);
                if (!targetTable) {
                    alert('対象の明細テーブルが見つかりません。');
                    return;
                }

                const tbody = targetTable.querySelector('tbody');
                if (!tbody) return;
                const rows = Array.from(tbody.querySelectorAll('tr'));
                if (rows.length <= 1) return;

                // ★修正: targetTableのヘッダーだけを取得
                const headers = Array.from(targetTable.querySelectorAll('thead th'));
                const idxDate = headers.findIndex(th => th.getAttribute('data-name') === FIELD_MAP.date); 
                const idxDep  = headers.findIndex(th => th.getAttribute('data-name') === FIELD_MAP.dep); 
                const idxArr  = headers.findIndex(th => th.getAttribute('data-name') === FIELD_MAP.arr); 

                if (idxDate === -1 || idxDep === -1 || idxArr === -1) {
                    alert('並び替えに失敗しました。');
                    console.log('並び替えに必要な項目が一覧に表示されていません。');
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
                    const dateA = new Date(cleanDateA).getTime() || 0;
                    const dateB = new Date(cleanDateB).getTime() || 0;
                    if (dateA !== dateB) return dateA - dateB; 

                    if (a.arr !== "" && a.arr === b.dep) return -1;
                    if (b.arr !== "" && b.arr === a.dep) return 1;

                    return 0; 
                });

                rowData.forEach(item => tbody.appendChild(item.element));
                
                // 変更をプリザンターに検知させる(Wrapにイベントを飛ばす)
                document.querySelector('#Issues_Source' + CHILD_TABLE_ID + 'Wrap').dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        //#endregion
    };
    //#endregion

    //#region<メイン処理：アクセス制御とUI構築>
    const isKeiriMember = (typeof $p.groupIds === 'function') ? $p.groupIds().includes(KEIRI_GROUP_ID) : false;
    const isGAAppMember = (typeof $p.groupIds === 'function') ? $p.groupIds().includes(GAAPP_GROUP_ID) : false;
    
    (async () => {
        //#region<<権限確認>>
        const applicantId = String($p.getControl(CLASS_USER).val() || ''); 
        const creatorId   = String($p.getControl(CLASS_CREATOR).val() || '');
        const superiorId  = String($p.getControl(CLASS_SUPERIOR).val() || '');
        
        const isApplicant = (currentUserId === applicantId) || (currentUserId === creatorId);
        const isSuperior = (superiorId !== '' && currentUserId === superiorId);
        
        const st = $p.getControl('Status').text(); 
        const isStatusEdit = (st === STATUS_TEXT.creating || st === STATUS_TEXT.reject);
        const isStatusApproval = (st === STATUS_TEXT.approval);
        const isStatusPayment = (st === STATUS_TEXT.underrev);
        const isStatusFinalApproval = (st === STATUS_TEXT.finalapp);
        const isStatusSettling = (st === STATUS_TEXT.underset);
        const isStatusCompleted = (st === STATUS_TEXT.completed); 

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
        else if ((isStatusPayment || isStatusSettling || isStatusCompleted) && isKeiriMember) {
            allowEditFields = false;
            showProcessButtons = true; 
        }
        else if(isStatusFinalApproval && isGAAppMember){
            allowEditFields = false;
            showProcessButtons = true; 
        }
        
        if (GeneralAffairs_editable && isKeiriMember){
            allowEditFields = true;
            showProcessButtons = true;
        }

        if(GeneralAffairs_editable && isKeiriMember){
            sessionStorage.setItem(SESSION_KEY_ACC_EDITABLE, currentUserId);
        }
        else{
            sessionStorage.removeItem(SESSION_KEY_ACC_EDITABLE);
        }
        //#endregion

        //#region<<権限毎の画面制御>>
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
            $fields.find('date-field').each(function() {
                const $wrapper = $(this);
                const $input = $wrapper.find('input');
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
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            });
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
        let retryCount = 0; 
        const MAX_RETRIES = 100; 
        const setupAccountingCheckboxes = () => {
            const gridWrap = document.querySelector('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
            // ★修正: 他のテーブルに惑わされないよう、明細テーブル本体をピンポイント指定
            const targetTable = document.querySelector('#Issues_Source' + CHILD_TABLE_ID);

            if (!gridWrap || !targetTable) {
                if (++retryCount < MAX_RETRIES) setTimeout(setupAccountingCheckboxes, 100);
                return;
            }

            // ★修正: gridWrapからではなく、targetTableから探す
            const th = targetTable.querySelector(`th[data-name="${TRAFREC_CLASS_ACCCHECK}"]`);
            const rows = targetTable.querySelectorAll('tbody > tr');

            if (!th || rows.length === 0) {
                if (++retryCount < MAX_RETRIES) setTimeout(setupAccountingCheckboxes, 100);
                return;
            }
            
            const isAccountingMode = $p.getValue(CLASS_ACCCHECK);
            
            // ★修正: targetTableの中のヘッダーだけを数える
            const headers = Array.from(targetTable.querySelectorAll('thead th'));
            const colIndex = headers.indexOf(th);

            if (!isAccountingMode) {
                th.style.display = 'none';
                rows.forEach(tr => {
                    if (tr.children[colIndex]) tr.children[colIndex].style.display = 'none';
                });

            } else {
                let currentCheckedList = $p.getControl(PARENT_CHECKED_LIST_COL).val() || ",";
                if (currentCheckedList === "") currentCheckedList = ",";

                rows.forEach(tr => {
                    const recordId = tr.getAttribute('data-id');
                    const targetCell = tr.children[colIndex];

                    if (recordId && targetCell) {
                        if(targetCell.querySelector('.accounting-checkbox')) return; 

                        const isChecked = currentCheckedList.includes(',' + recordId + ',');

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'accounting-checkbox';
                        checkbox.setAttribute('data-record-id', recordId);
                        checkbox.checked = isChecked;
                        
                        if ((!isKeiriMember || currentStatus !== STATUS_TEXT.underrev) && $p.userId() !== 1) {
                            checkbox.addEventListener('click', (e) => {
                                e.preventDefault(); 
                            });
                        }

                        checkbox.style.transform = 'scale(1.5)';
                        checkbox.style.cursor = 'pointer';
                        checkbox.style.margin = '5px';

                        targetCell.innerHTML = '';
                        targetCell.appendChild(checkbox);
                        targetCell.style.textAlign = 'center';

                        targetCell.addEventListener('click', (e) => {
                            e.stopPropagation(); 
                        });
                    }
                });

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
                        }
                    });
                    gridWrap.dataset.hasEvent = "true";
                }

                if (isKeiriMember && currentStatus === STATUS_TEXT.underrev && $('#BtnCheckAllAccounting').length === 0) {
                    const checkAllBtnHtml = `<button id="BtnCheckAllAccounting" class="button button-icon ui-button ui-corner-all ui-widget" style="margin-left: 10px; margin-bottom: 5px;"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-check"></span>経理一括ON/OFF</button>`;
                    
                    const $gridContainer = $('#Issues_Source' + CHILD_TABLE_ID + 'Wrap');
                    if ($gridContainer.length > 0) {
                        $gridContainer.after(checkAllBtnHtml);
                    }

                    $(document).off('click', '#BtnCheckAllAccounting').on('click', '#BtnCheckAllAccounting', function(e) {
                        e.preventDefault();
                        
                        // ★修正: targetTableから探す
                        const checkboxes = targetTable.querySelectorAll('.accounting-checkbox');
                        if (checkboxes.length === 0) return;

                        let isAllChecked = true;
                        checkboxes.forEach(cb => { if (!cb.checked) isAllChecked = false; });

                        let list = $p.getControl(PARENT_CHECKED_LIST_COL).val() || ",";
                        if (list === "") list = ",";

                        checkboxes.forEach(cb => {
                            const recId = cb.getAttribute('data-record-id');
                            if (isAllChecked) {
                                cb.checked = false;
                                list = list.replace(',' + recId + ',', ',');
                            } else {
                                cb.checked = true;
                                if (!list.includes(',' + recId + ',')) list += recId + ',';
                            }
                        });

                        if (list === ",") list = "";
                        $p.set($p.getControl(PARENT_CHECKED_LIST_COL), list);
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
            // ★修正: targetTableに限定
            const targetTable = document.querySelector('#Issues_Source' + CHILD_TABLE_ID);
            
            if (!targetTable) {
                if (++disableSortRetryCount < MAX_DISABLE_SORT_RETRIES) setTimeout(disableDefaultSort, 100);
                return;
            }

            const headerRow = targetTable.querySelector('thead tr.ui-widget-header');
            
            if (headerRow) {
                headerRow.style.pointerEvents = 'none';
            } else {
                if (++disableSortRetryCount < MAX_DISABLE_SORT_RETRIES) setTimeout(disableDefaultSort, 100);
            }
        };

        disableDefaultSort();
        //#endregion

        //#region<<PDFボタン>>
        if($p.action() !== 'new' && isKeiriMember && currentStatus !== STATUS_TEXT.creating){
            if ($('#BtnPrintPdfParent').length === 0) {
                $('#MainCommands').append('<button id="BtnPrintPdfParent" class="button button-icon ui-button ui-corner-all ui-widget"><span class="ui-button-icon-left ui-icon ui-checkboxradio-icon ui-icon-document"></span>PDF出力</button>');
                
                $('#BtnPrintPdfParent').on('click', async function() {
                    var parentId = $p.id();
                    if (!parentId) { alert('レコードが保存されていません。'); return; }
                    var userName = $p.getControl(PARENT_USER_COLUMN).find('option:selected').text().trim();
                    if (!userName) userName = $p.getControl(PARENT_USER_COLUMN).text().trim();

                    if (!confirm('以下の条件でPDFを出力しますか？\n\n・対象：紐付いている全明細\n・利用者：' + userName)) return;

                    try {
                        const updateSuccess = await updateChildOrder();
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

                        const getUserName = (classId) => {
                            const $ctrl = $p.getControl(classId);
                            let name = $ctrl.find('option:selected').text().trim();
                            if (!name) name = $ctrl.text().trim();
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
                        
                        var sendApprovalList = {};
                        
                        if(currentStatus !== STATUS_TEXT.creating && currentStatus !== STATUS_TEXT.reject){ 
                            sendApprovalList.user = {
                                "name": getUserName(CLASS_USER), 
                                "date": $p.getControl(CLASS_REQUESTDATE).text()
                            };
                        }
                        if(currentStatus !== STATUS_TEXT.creating && currentStatus !== STATUS_TEXT.reject && currentStatus !== STATUS_TEXT.approval){
                            sendApprovalList.superior = {
                                "name": getUserName(CLASS_SUPERIOR), 
                                "date": $p.getControl(CLASS_SUPFIXDATE).val()
                            };
                        }
                        if(currentStatus !== STATUS_TEXT.creating && currentStatus !== STATUS_TEXT.reject && currentStatus !== STATUS_TEXT.approval && currentStatus !== STATUS_TEXT.underrev){
                            sendApprovalList.accounting = {
                                "name": getUserName(CLASS_ACCID), 
                                "date": $p.getControl(CLASS_ACCFIXDATE).val()
                            };
                        }
                        if(currentStatus === STATUS_TEXT.underset || currentStatus === STATUS_TEXT.completed){ 
                            sendApprovalList.generalaffair = {
                                "name": getUserName(CLASS_GAID), 
                                "date": $p.getControl(CLASS_GAFIXDATE).val()
                            };
                        }
                        if($p.getControl(CLASS_FIXDATE).text() !== '' && $p.getControl(CLASS_PAYWAY).text() === PAYWAY_INDIV){ 
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
            $('#BtnPrintPdfParent').show();
        }
        //#endregion

    })();
    //#endregion

    //#region<自動入力系>
    if($p.getControl(CLASS_CREATOR).val() === ''){
        $p.set($p.getControl(CLASS_CREATOR), $p.userId());
    }
    if(currentStatus === STATUS_TEXT.approval){
        const today = new Date();
        $p.set($p.getControl(CLASS_SUPFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
    }
    else if(currentStatus == STATUS_TEXT.reject && $p.getControl(CLASS_SUPFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_SUPFIXDATE), '');
    }
    if(currentStatus === STATUS_TEXT.underrev){
        const today = new Date();
        $p.set($p.getControl(CLASS_ACCFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
        $p.set($p.getControl(CLASS_ACCID), $p.userId());
    }
    else if(currentStatus == STATUS_TEXT.reject && $p.getControl(CLASS_ACCFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_ACCFIXDATE), '');
    }
    if(currentStatus === STATUS_TEXT.finalapp){
        const today = new Date();
        $p.set($p.getControl(CLASS_GAFIXDATE), today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate());
        $p.set($p.getControl(CLASS_GAID), $p.userId());
    }
    else if(currentStatus == STATUS_TEXT.reject && $p.getControl(CLASS_GAFIXDATE).val() !== ''){
        $p.set($p.getControl(CLASS_GAFIXDATE), '');
    }
    //#endregion

    //#region <子レコード並び替え & 一括更新機能>
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

    let isChildUpdating = false; 

    $p.events.before_send = function (args) {
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

        if ($sender && ($sender.attr('id') === 'DeleteCommand' || $sender.attr('name') === 'Delete')) {
            return true;
        }
        if (isChildUpdating) {
            return true;
        }

        (async () => {
            try {
                await updateChildOrder();
                isChildUpdating = true;
                $sender.trigger('click');
            } catch (e) {
                console.error("並び替え更新エラー", e);
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
    // ★修正: 対象テーブルを直接指定
    const targetTable = document.querySelector('#Issues_Source' + CHILD_TABLE_ID);
    
    if (!targetTable) return true; 

    const allCheckboxes = targetTable.querySelectorAll('.accounting-checkbox');
    const checkedBoxes = targetTable.querySelectorAll('.accounting-checkbox:checked');

    if (allCheckboxes.length > 0 && allCheckboxes.length !== checkedBoxes.length) {
        alert('【エラー】\n経理チェックが完了していない明細があるため、決済(完了)に進めません。');
        return false; 
    }
    
    return true; 
};
// #endregion