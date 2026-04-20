// /web/pleasanter/Implem.Pleasanter/App_Data/Parameters/ExtendedScripts/に本ファイルを格納すること
$(function() {
    // 現在のURLがトップページ（ / または /items ）かどうかを判定
    if (window.location.pathname === '/' || window.location.pathname.toLowerCase() === '/items') {
        
        // 表示したいガイドのHTML（デザインは画像のスタートガイドに寄せています）
        var guideHtml = 
            '<div style="background-color: #fff9e6; padding: 15px; margin-bottom: 20px; border-radius: 4px; border: 1px solid #f2c05d;">' +
                '<h3 style="font-size: 16px; margin-top: 0; color: #333;">✨ 社内管理システム ポータル</h3>' +
                '<p style="margin-bottom: 5px; font-size: 14px; color: #333;">ここはトップページです。目的のフォルダやサイトを選択してください。</p>' +
                '<p style="margin-bottom: 0; font-size: 14px;">' +
                    '📕 <a href="https://docs.google.com/document/d/1vZs_zm7RBkdSFO8watpdgOm2nT9wkILPhhpessspmYI/preview" target="_blank" style="color: #058266; text-decoration: none;">システム全体の総合マニュアルはこちら</a>' +
                '</p>' +
            '</div>';
        
        // 画面のメインコンテナ（一番上）に挿入する
        $('#MainContainer').prepend(guideHtml);
    }
});