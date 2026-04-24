// 交通費申請 サーバースクリプト レコード読み込み時
const userId = context.UserId;
const st = model.Status;
const KEIRI_GROUP_ID = 2;
const GAAPP_GROUP_ID = 3;

const FAV_TABLE_ID = 7;
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

const HIST_TABLE_ID = 8;
const HIST_USER_COL = 'ClassD'; 
const HIST_REGISTDATE = 'DateA';
const HIST_MEMO = 'Body';
const HIST_REGISTQTY = 5;
const HIST_FIELD_MAP = {
    destination: 'Title',
    dep:         'ClassA',
    arr:         'ClassB',
    way:         'ClassC',
    amount:      'NumA'
};

const CHILD_FIELD_MAP = {
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
}


// 1. 権限判定
const isKeiri = groups.Get(KEIRI_GROUP_ID).ContainsUser(userId);
const isGAApp = groups.Get(GAAPP_GROUP_ID).ContainsUser(userId);
const isApplicant = (userId.toString() === model.ClassA || userId.toString() === model.ClassD);
const isSuperior = (userId.toString() === model.ClassB);

// 2. 表示・読み取り専用制御 (JSで書いていたロジックをサーバーへ)
const canEdit = (isApplicant && (st == 100 || st == 910)) || (isKeiri && true); // 特例含む

if (!canEdit) {
    // 全項目を読み取り専用に設定
    columns.Get().forEach(column => {
        column.ReadOnly = true;
    });
}

// 3. 【目玉機能】経路履歴とお気に入りのHTMLを作成
const historyItems = items.Get(HIST_TABLE_ID, JSON.stringify({
    View: {
        ColumnFilterHash: { [HIST_USER_COL]: JSON.stringify([userId.toString()]) },
        ColumnSorterHash: { CreatedTime: "desc" }
    },
    PageSize: 5
}));

const favoriteItems = items.Get(FAV_TABLE_ID, JSON.stringify({
    View: {
        ColumnFilterHash: { [FAV_USER_COL]: JSON.stringify([userId.toString()]) },
        ColumnSorterHash: { CreatedTime: "desc" }
    },
    PageSize: 5
}));

// --- (A) 「経路履歴」の表の中身を作る ---
let histHtml = "";
if (historyItems.Count === 0) {
    histHtml = '<p style="margin:10px;">経路履歴がありません。</p>';
} else {
    histHtml = '<table class="grid" style="width:100%; font-size:12px;">';
    histHtml += '<thead style="background:rgba(128,128,128,0.1);"><tr><th></th><th>行先</th><th>経路</th><th>金額</th></tr></thead><tbody>';
    
    Array.from(historyItems).forEach(item => {
        const copyData = {
            [CHILD_FIELD_MAP.destination]: item[HIST_FIELD_MAP.destination],
            [CHILD_FIELD_MAP.dep]: item[HIST_FIELD_MAP.dep],
            [CHILD_FIELD_MAP.arr]: item[HIST_FIELD_MAP.arr],
            [CHILD_FIELD_MAP.way]: item[HIST_FIELD_MAP.way],
            [CHILD_FIELD_MAP.amount]: item[HIST_FIELD_MAP.amount],
            _mode: 'copy'
        };
        const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
        
        histHtml += `<tr>
            <td><button type="button" class="select-route-btn ui-button" data-json="${jsonStr}">選択</button></td>
            <td>${item[HIST_FIELD_MAP.destination]}</td>
            <td>${item[HIST_FIELD_MAP.dep]} → ${item[HIST_FIELD_MAP.arr]}</td>
            <td style="text-align:right;">${item[HIST_FIELD_MAP.amount].toLocaleString()}円</td>
        </tr>`;
    });
    histHtml += '</tbody></table>';
}

// --- (B) 「お気に入り経路」のプレースホルダー ---

let favHtml = '<p id="fav-loading-msg" style="margin:10px;">（お気に入り経路を読み込んでいます...）</p>';
if (favoriteItems.Count === 0) {
    favHtml = '<p style="margin:10px;">お気に入り経路がありません。</p>';
} else {
    // テーブルのヘッダー部分を作成
    favHtml = '<table class="grid" style="width:100%; font-size:12px; border-collapse: collapse;">';
    favHtml += '<thead style="background:#eee;"><tr><th style="width:70px; padding:5px;"></th><th style="padding:5px;">名称</th><th style="padding:5px;">行先</th><th style="padding:5px;">経路</th><th style="width:80px; padding:5px;">金額</th><th style="width:30px; padding:5px;"></th></tr></thead><tbody>';

    Array.from(favoriteItems).forEach(item => {
        logs.LogInfo(item);
        // 削除機能用のレコードID
        const recordId = item.ResultId;

        // コピー用データの組み立て（ClassHashやNumHashは使わず、直下から取得）
        const copyData = {
            [CHILD_FIELD_MAP.destination]: item[FAV_FIELD_MAP.destination],
            [CHILD_FIELD_MAP.dep]: item[FAV_FIELD_MAP.dep],
            [CHILD_FIELD_MAP.arr]: item[FAV_FIELD_MAP.arr],
            [CHILD_FIELD_MAP.way]: item[FAV_FIELD_MAP.way],
            [CHILD_FIELD_MAP.amount]: item[FAV_FIELD_MAP.amount],
            [CHILD_FIELD_MAP.memo]: item[FAV_FIELD_MAP.memo],
            _mode: 'copy'
        };
        const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');

        // 経路表示用テキスト（例: 品川 → 東京 (JR)）
        const routeDesc = (item[FAV_FIELD_MAP.dep] || '') + ' → ' + (item[FAV_FIELD_MAP.arr] || '') + ' <span style="color:#666;">(' + (item[FAV_FIELD_MAP.way] || '-') + ')</span>';

        favHtml += `<tr style="border-bottom:1px solid #eee;">
            <td style="text-align:center; padding: 5px;">
                <button type="button" class="select-route-btn ui-button ui-corner-all ui-widget" 
                style="padding:2px 8px; font-size:11px; white-space: nowrap;" data-json="${jsonStr}">選択</button>
            </td>
            <td style="padding: 5px;">${item[FAV_FIELD_MAP.title] || ''}</td>
            <td style="padding: 5px;">${item[FAV_FIELD_MAP.destination] || ''}</td>
            <td style="padding: 5px;">${routeDesc}</td>
            <td style="text-align:right; padding: 5px;">${(item[FAV_FIELD_MAP.amount] || 0).toLocaleString()}円</td>
            <td style="text-align:center; padding: 5px;">
                <button type="button" class="delete-fav-btn ui-button ui-corner-all ui-widget" style="padding: 1px 6px; font-size: 11px; color: white; background-color: #d9534f; border: 1px solid #d43f3a; border-radius: 3px;" title="削除" data-id="${recordId}">×</button>
            </td>
        </tr>`;
    });

    favHtml += '</tbody></table>';
}


// --- (C) 「パネルとタブ」の全体HTMLを組み立てる ---
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
                ${histHtml}
            </div>
            <div id="tab-fav" style="min-height: 150px; padding: 10px 0; border-top: none;">
                ${favHtml}
            </div>
        </div>
    </div>
    <h4 style="margin-top: 30px; margin-bottom: 10px; font-weight: bold; border-bottom: 2px solid #00b32da4; padding-bottom: 5px; width: 100%;">
        <span class="ui-icon ui-icon-note" style="display:inline-block; vertical-align:middle; margin-right:5px;"></span>登録中の交通費情報
    </h4>
</div>`;

// --- (D) 組み立てた全体HTMLを挿入する ---/
const hiddenPanel = '<div id="TempRoutePanel" style="display:none;">' + panelHtml + '</div>';
columns.Status.ExtendedHtmlAfterField = hiddenPanel;